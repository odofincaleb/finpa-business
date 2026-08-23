import { detectIntent, parseBusinessMessage } from "../lib/localParse";

describe("parseBusinessMessage", () => {
  it("parses a POS sale with quantity", () => {
    const parsed = parseBusinessMessage("Sold 5 shirts ₦75k POS");
    expect(parsed?.intent).toBe("sale");
    expect(parsed?.items[0].amount).toBe(75000);
    expect(parsed?.items[0].quantity).toBe(5);
    expect(parsed?.items[0].payment_method).toBe("pos");
    expect(parsed?.items[0].item_or_service?.toLowerCase()).toContain("shirt");
  });

  it("parses received-from as a sale", () => {
    const parsed = parseBusinessMessage("Received ₦120k from Mr Ade for tiles");
    expect(parsed?.intent).toBe("sale");
    expect(parsed?.items[0].amount).toBe(120000);
    expect(parsed?.items[0].customer_name).toMatch(/Ade/i);
  });

  it("splits two sales in one line", () => {
    const parsed = parseBusinessMessage("Sales today: ₦180,000 cash, ₦45k POS");
    expect(parsed?.intent).toBe("sale");
    expect(parsed?.items).toHaveLength(2);
    expect(parsed?.items[0].amount).toBe(180000);
    expect(parsed?.items[0].payment_method).toBe("cash");
    expect(parsed?.items[1].amount).toBe(45000);
    expect(parsed?.items[1].payment_method).toBe("pos");
  });

  it("parses rent expense via transfer", () => {
    const parsed = parseBusinessMessage("Paid shop rent ₦250k via transfer");
    expect(parsed?.intent).toBe("expense");
    expect(parsed?.items[0].amount).toBe(250000);
    expect(parsed?.items[0].category).toBe("Rent");
    expect(parsed?.items[0].payment_method).toBe("transfer");
  });

  it("parses inventory and utilities expenses", () => {
    expect(parseBusinessMessage("Bought ₦45k tomatoes for restaurant")?.items[0].category).toBe(
      "Inventory",
    );
    expect(parseBusinessMessage("Paid electricity ₦18,500")?.items[0].amount).toBe(18500);
  });

  it("parses credit / debtor phrases", () => {
    const credit = parseBusinessMessage("Gave credit of ₦50k to Mary for rice");
    expect(credit?.intent).toBe("debtor");
    expect(credit?.debtor_name).toMatch(/Mary/i);
    expect(credit?.debtor_total).toBe(50000);

    const partial = parseBusinessMessage("Sold fuel ₦30k to Mr Ade, paid ₦10k, balance ₦20k");
    expect(partial?.intent).toBe("debtor");
    expect(partial?.debtor_total).toBe(30000);
    expect(partial?.debtor_paid).toBe(10000);
    expect(partial?.debtor_balance).toBe(20000);
  });

  it("defaults amount-only business talk to sale", () => {
    expect(detectIntent("₦15,000 POS")).toBe("sale");
  });
});
