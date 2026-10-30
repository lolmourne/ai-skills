---
title: Checkout v2
preset: modern
paper: a4
margins: 1
---

# Goals

We want first-time buyers to finish without creating an account.

- Faster checkout
  - Guest checkout on every platform
- Fewer drop-offs at the payment step

# Flow

![Checkout flow](exports/checkout-flow.png "width=Full project=checkout-flow.bcanvas")

# Requirements

1. Guest checkout with email only
2. Saved cards with **3DS**
3. See the [payment spec](https://example.com/spec) for retries

| Metric | Target |
| --- | --- |
| Conversion | +5% |
| p95 latency | 300ms |

> Nothing here changes how refunds work.

## Open questions

- [ ] Do guests get a receipt by email?
- [x] Is 3DS required for saved cards?

```json
{ "guest": true }
```
