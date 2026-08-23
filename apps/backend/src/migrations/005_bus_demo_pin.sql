-- Treat BUS-DEMO-* (and legacy FINPA-DEMO-*) as demo PINs.

CREATE OR REPLACE FUNCTION redeem_activation_pin(
  p_code TEXT,
  p_user_id UUID,
  p_allow_demo BOOLEAN DEFAULT FALSE
)
RETURNS profiles
LANGUAGE plpgsql
AS $$
DECLARE
  v_pin activation_pins%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_base TIMESTAMPTZ;
  v_expires TIMESTAMPTZ;
  v_normalized TEXT;
  v_is_demo BOOLEAN;
  v_updated INT;
BEGIN
  v_normalized := upper(trim(p_code));
  v_is_demo := v_normalized LIKE 'BUS-DEMO-%' OR v_normalized LIKE 'FINPA-DEMO-%';

  IF v_is_demo AND NOT p_allow_demo THEN
    RAISE EXCEPTION 'PIN_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_pin
  FROM activation_pins
  WHERE code = v_normalized
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PIN_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF v_pin.redeemed_by IS NOT NULL AND NOT v_is_demo THEN
    RAISE EXCEPTION 'PIN_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF v_pin.expires_at IS NOT NULL AND v_pin.expires_at < now() THEN
    RAISE EXCEPTION 'PIN_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_profile
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PIN_INVALID' USING ERRCODE = 'P0001';
  END IF;

  v_base := greatest(now(), coalesce(v_profile.subscription_expires_at, now()));
  v_expires := v_base + make_interval(days => v_pin.duration_days);

  IF NOT v_is_demo THEN
    UPDATE activation_pins
    SET redeemed_by = p_user_id,
        redeemed_at = now()
    WHERE id = v_pin.id
      AND redeemed_by IS NULL;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RAISE EXCEPTION 'PIN_INVALID' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE profiles
  SET
    subscription_period = v_pin.period,
    subscription_expires_at = v_expires,
    activated_at = coalesce(v_profile.activated_at, now()),
    pin_code = v_normalized
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;
