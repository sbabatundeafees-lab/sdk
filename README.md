# Singular SDKs

The three standalone gateways, one file each, frozen here as the reference for the modular build.


| Folder | SDK file | Global | Source | Test page |
|---|---|---|---|---|
| `1-pulsebridge/` | `pulsebridge-sdk.js` | `InlineJS` | Stage server copy (shared by Emmanuel, 19 Sep 2026) | `index.html` |
| `2-standard/`    | `standardpaymentsdk.js` | `EgolePay` | Standalone build from `paymentgateway-standard/` | `index.html` |
| `3-inter/`       | `webbridge.js` | `EgolePay` | InterPaymentGateway hybrid bridge (Jul 2026) — token / `tnxBearer` / VAS payload | `index.html` |

All test pages use test keys (`sk_test_…`).

## Shared design + e-Receipt (19 Sep 2026)

The Standard SDK is the design reference (DM Sans, navy sidebar, orange
accents, round close button, result modal). The **result modal and e-Receipt
are one shared block** — `shared/egp-receipt.js` — embedded verbatim into all
three SDK files between `/* EGP-RECEIPT-BEGIN */ … /* EGP-RECEIPT-END */`.

```sh
# after editing shared/egp-receipt.js (run from inside "singular sdks")
python3 shared/embed.py
```

Never edit the embedded copies by hand; they are overwritten by the script.

What the receipt shows (same on every gateway):

- EgolePay watermark tiles + logo ghost, status stamp, TEST-mode banner
- **Amount → Total only.** No amount / service-charge split (per Mr Emma).
- **LIRS Receipts** section right after the total (PulseBridge only, when the
  gateway returns `merchantReturnUrl`):
  - `webguid` → one **Download LIRS Receipt** button
  - `harmonized` → one row per item with its own **Download** button. The
    backend now sends `link#Item name` per item (several joined by `$$`);
    `name#link` is accepted too. The name is shown, the link is opened.
- Payer block, verification code, Print as PDF.

Each SDK supplies its own `buildReceipt()` (what to put on the receipt) and
decides what **Done** does; everything visual comes from the shared block.
`onSuccess` on PulseBridge now also carries `receipts: [{label, url}]` and the
full `receipt` object.


## Run

Serve the folder over HTTP and open the page you want:

```sh
cd ~/Downloads/egolepay-sdks/"singular sdks"
python3 -m http.server 8790
# http://localhost:8790/1-pulsebridge/
# http://localhost:8790/2-standard/
# http://localhost:8790/3-inter/
```

## How each one starts

- **PulseBridge** — bill-payment flow. Enter a reference + type, click Pay Now.
  The page reloads with `?ref=…&type=webguid` on the URL and the SDK picks it up
  (bill lookup → confirm → card/transfer → OTP → receipt).
- **Standard** — plain checkout. Enter amount + email, click Pay now.
  The page generates a fresh `txnRef` and opens the modal.
- **Inter** — VAS flow. Enter a reference, amount, email; pick Test/Live; click Pay Now.
  Passes `apiKey`, `tnxType: "VAS"`, `tnxBearer` (JWT) and the encrypted `payload`.
  Hosts: `sk_test_*` → `stage-gatewayservice.egolepay.com/api/InterPaymentGateway`
  (was `paywebbackoffice-test`, which now returns 405 — changed 19 Sep 2026),
  otherwise `payments.egolepay.com/api/StandardPaymentGateway`.
  Paste the `tnxBearer` JWT into the Token box on the page — it is not hard-coded.
  On success/cancel/error the page redirects to `/payment/success` etc. (edit the
  `*_CALLBACK_URL` constants at the top of the script).

`2-standard` and `3-inter` both define `window.EgolePay`, so never load them on the same page.
