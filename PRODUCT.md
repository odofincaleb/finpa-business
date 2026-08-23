# FINPA Business — Product Overview

**FINPA Business** is the business sibling of FINPA. It records **sales**, **expenses**, and **debtors**, and shows a daily **estimated profit** snapshot.

Access uses the same **PIN + Paystack** flow as FINPA (shared webhook router). Data lives on self-hosted Postgres. Login uses Supabase Auth.

**Repo:** https://github.com/odofincaleb/finpa-business

## Core M1 surfaces

- Business dashboard (today sales / expenses / profit)
- Record sale (cash, POS, transfer, credit)
- Record expense (category picker)
- Combined ledger
- Debtors + payment history
- PIN activation and admin PIN tools
