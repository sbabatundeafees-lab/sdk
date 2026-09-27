/*!
 * EgolePay Standard Payment SDK (standalone, no build step)
 * Usage: new EgolePay({ apiKey, amount, email, txnRef, ...options, ...callbacks })
 */
/* ==== Encryption (AES-CBC + RSA-OAEP envelope) ==== */
class PayloadEncryption {
    constructor(e = null) {
        this.rsaPublicKey =
            e ||
                "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt0KgRHBhfBbGM3hjrzSG\nueU9qgmkz9K5rTRGSSOznfOCJxTv4Wb46+/Hvvolh/fqgDMFzu9ygcbqw1BanLIR\nUySFbChqw7KudC8LF+D/QaHCoOsy3ce4HZXsdCmqWwH3j0eyP+WAZnezYW6ZYMzp\nRHeQoFMqNoEVZzc8Qnhd1T74oTpqmodr0pElw7s9yw1ckSfLDSVI9QRdIneaBYiI\nuCVbFtmIgM26BsRVwYTXvkMZEbJpTMeWheRr3WLlS9tHFMAPAM3HQ+TDFgOaKyqF\nOTjsJBv4Xeqbmrva+wTOOnLhYOPbVHlfhD+Jqu3phkCIIki8nFE9ZPUlYf/qP6Bn\n9QIDAQAB\n-----END PUBLIC KEY-----";
    }
    generateRandomBytes(e) {
        const t = new Uint8Array(e);
        return (crypto.getRandomValues(t), t);
    }
    arrayBufferToBase64(e) {
        const t = new Uint8Array(e);
        let n = "";
        for (let e = 0; e < t.byteLength; e++)
            n += String.fromCharCode(t[e]);
        return btoa(n);
    }
    base64ToArrayBuffer(e) {
        const t = atob(e), n = new Uint8Array(t.length);
        for (let e = 0; e < t.length; e++)
            n[e] = t.charCodeAt(e);
        return n.buffer;
    }
    async importRSAKey(e) {
        try {
            const t = e
                .replace(/-----BEGIN PUBLIC KEY-----/, "")
                .replace(/-----END PUBLIC KEY-----/, "")
                .replace(/\s/g, ""), n = this.base64ToArrayBuffer(t);
            return await crypto.subtle.importKey("spki", n, { name: "RSA-OAEP", hash: "SHA-256" }, !1, ["encrypt"]);
        }
        catch (e) {
            throw new Error(`Failed to import RSA key: ${e.message}`);
        }
    }
    async encryptWithAES(e, t, n) {
        try {
            const o = new TextEncoder().encode(e), r = await crypto.subtle.importKey("raw", t, { name: "AES-CBC" }, !1, ["encrypt"]), i = await crypto.subtle.encrypt({ name: "AES-CBC", iv: n }, r, o);
            return this.arrayBufferToBase64(i);
        }
        catch (e) {
            throw new Error(`AES encryption failed: ${e.message}`);
        }
    }
    async encryptAESKeyWithRSA(e, t) {
        try {
            const n = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, t, e);
            return this.arrayBufferToBase64(n);
        }
        catch (e) {
            throw new Error(`RSA encryption failed: ${e.message}`);
        }
    }
    async encrypt(e, t = null) {
        try {
            const n = t || this.rsaPublicKey, o = this.generateRandomBytes(32), r = this.generateRandomBytes(16), i = await this.importRSAKey(n), a = "string" == typeof e ? e : JSON.stringify(e), s = await this.encryptWithAES(a, o, r), d = {
                EncryptedAesKey: await this.encryptAESKeyWithRSA(o, i),
                IV: this.arrayBufferToBase64(r),
                EncryptedData: s,
            }, p = JSON.stringify(d);
            return { encryptedData: btoa(p) };
        }
        catch (e) {
            throw new Error(`Encryption failed: ${e.message}`);
        }
    }
    isSupported() {
        return ("undefined" != typeof crypto &&
            void 0 !== crypto.subtle &&
            void 0 !== crypto.getRandomValues);
    }
    setRSAPublicKey(e) {
        this.rsaPublicKey = e;
    }
}
/* ==== Config ==== */
const BASE_URL = "https://stage-gatewayservice.egolepay.com/api/StandardPaymentGateway";
const EgolePayAssets = {
    logo: "https://res.cloudinary.com/dl9m2dzgk/image/upload/v1725615415/MicrosoftTeams-image_7_sjbwtk.png",
    cardSchemes: [
        { alt: "Verve", src: "https://res.cloudinary.com/dl9m2dzgk/image/upload/v1728658969/verve_copy_gufwqi.png" },
        { alt: "Mastercard", src: "https://res.cloudinary.com/dl9m2dzgk/image/upload/v1728658969/masterCard_copy_brm2z9.png" },
        { alt: "Visa", src: "https://res.cloudinary.com/dl9m2dzgk/image/upload/v1728658969/Visa_copy_uzr8ge.png" },
    ],
};
/* ==== Checkout ==== */
/* EGP-RECEIPT-BEGIN */
/* ======================================================================
 * EgolePay shared e-Receipt + result modal
 *
 * This exact block is embedded in pulsebridge-sdk.js, standardpaymentsdk.js
 * and webbridge.js so every gateway shows the same receipt. Edit
 * shared/egp-receipt.js and run `python3 shared/embed.py`; never edit the
 * embedded copies by hand.
 *
 * Each SDK installs it with `Object.assign(<Class>.prototype, EgolePayReceipt)`
 * and supplies a `receipt` object (see buildReceipt in each SDK):
 *   { merchantReference, gatewayReference, paymentReference, status,
 *     statusLabel, message, total, currency, description, channel,
 *     paidAt, paidAtLabel, customer:{name,email,phone}, card, bank,
 *     metadata, mode, externalReceipts:[{label,url}], externalReceiptsTitle }
 *
 * Per Mr Emma (19 Sep 2026): the receipt shows the TOTAL only — no
 * amount / service-charge split.
 * ====================================================================== */
const EgolePayReceipt = {
    _esc(value) {
        if (value === null || value === undefined)
            return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    },
    _formatMoney(value, currency) {
        const code = currency || this.currency || "NGN";
        const symbol = {
            NGN: "₦",
            USD: "$",
            GBP: "£",
            EUR: "€",
            GHS: "₵",
            KES: "KSh",
            ZAR: "R",
        }[code];
        const amount = Number(value || 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return symbol ? `${symbol}${amount}` : `${code} ${amount}`;
    },
    _formatReceiptDate(date) {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime()))
            return "";
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const pad = (n) => String(n).padStart(2, "0");
        const meridiem = d.getHours() >= 12 ? "PM" : "AM";
        const hour = d.getHours() % 12 || 12;
        const offset = -d.getTimezoneOffset();
        const tz = `GMT${offset >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
        return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(hour)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${meridiem} (${tz})`;
    },
    _sealReceipt(receipt) {
        const material = [
            receipt.merchantReference,
            receipt.gatewayReference,
            receipt.paymentReference,
            receipt.status,
            Number(receipt.total || 0).toFixed(2),
            receipt.currency,
            receipt.paidAt,
        ].join("|");
        let fnv = 0x811c9dc5;
        let djb = 5381;
        for (let i = 0; i < material.length; i++) {
            const code = material.charCodeAt(i);
            fnv = (fnv ^ code) >>> 0;
            fnv = (fnv + ((fnv << 1) + (fnv << 4) + (fnv << 7) + (fnv << 8) + (fnv << 24))) >>> 0;
            djb = ((djb << 5) + djb + code) >>> 0;
        }
        const block = (n) => n.toString(36).toUpperCase().padStart(7, "0").slice(-7);
        return `${block(fnv).slice(0, 4)}-${block(fnv).slice(4)}${block(djb).slice(0, 1)}-${block(djb).slice(1, 5)}`;
    },
    _statusLabel(status) {
        return {
            success: "SUCCESSFUL",
            failed: "FAILED",
            pending: "PENDING",
            cancelled: "CANCELLED",
        }[status] || String(status || "").toUpperCase();
    },

    /* ---- external (agency / LIRS) receipts ----
     * The gateway returns one merchantReturnUrl per settled item, several
     * joined by "$$". Harmonized bills now also carry the purchased item's
     * name after a "#":   https://host/receipt.pdf#Ground Rent 2026
     * Either order is accepted (whichever side is the URL is the link).
     * Returns [{label, url}] with duplicates removed, order preserved. */
    _parseExternalReceipts(rawUrls, names = [], fallbackLabel = "LIRS Receipt") {
        const list = Array.isArray(rawUrls)
            ? rawUrls
            : typeof rawUrls === "string" ? rawUrls.split("$$") : [];
        const isUrl = (v) => /^https?:\/\//i.test(String(v || "").trim());
        const seen = new Set();
        const out = [];
        list.forEach((raw, i) => {
            const text = String(raw || "").trim();
            if (!text)
                return;
            let url = text;
            let label = "";
            const hash = text.indexOf("#");
            if (hash > -1) {
                const a = text.slice(0, hash).trim();
                const b = text.slice(hash + 1).trim();
                if (isUrl(a)) {
                    url = a;
                    label = b;
                }
                else if (isUrl(b)) {
                    url = b;
                    label = a;
                }
            }
            if (!isUrl(url) || seen.has(url))
                return;
            seen.add(url);
            if (!label)
                label = (names && names[i]) || "";
            out.push({ url, label, fallback: !label });
        });
        // No name from "#" or the notifylist: number the fallbacks when there
        // are several so the payer can still tell the receipts apart.
        const unnamed = out.filter((x) => x.fallback);
        unnamed.forEach((x, n) => {
            x.label = unnamed.length > 1 ? `${fallbackLabel} ${n + 1}` : fallbackLabel;
        });
        out.forEach((x) => delete x.fallback);
        return out;
    },
    _openExternalReceipt(url) {
        if (!url)
            return;
        // The agency PDF is cross-origin with no CORS headers, so it cannot be
        // fetched into a blob. Desktop: new tab renders it. Mobile webviews
        // block new tabs, so trigger a same-context anchor click instead and
        // let the host app's download handler / PDF viewer take over.
        const isMobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
        if (isMobile) {
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "receipt.pdf";
            anchor.rel = "noopener";
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            return;
        }
        window.open(url, "_blank", "noopener");
    },

    /* ---- logo + watermarks ---- */
    async _resolveLogo() {
        if (this._logoDataUri !== undefined)
            return this._logoDataUri;
        this._logoDataUri = null;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            const response = await fetch(this.companyLogo, { mode: "cors", signal: controller.signal });
            clearTimeout(timer);
            if (!response.ok)
                throw new Error(`logo ${response.status}`);
            const blob = await response.blob();
            if (blob.size > 512 * 1024)
                throw new Error("logo too large to inline");
            this._logoDataUri = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            });
        }
        catch (err) {
            this._logoDataUri = null;
        }
        return this._logoDataUri;
    },
    _watermarkTile(receipt) {
        const tag = this._esc((receipt.gatewayReference || receipt.merchantReference || "").slice(0, 28));
        const svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="340" height="210" viewBox="0 0 340 210">',
            '<g transform="rotate(-28 170 105)" fill="#0F172A" fill-opacity="0.055"',
            ' font-family="Helvetica,Arial,sans-serif" text-anchor="middle">',
            '<text x="170" y="96" font-size="34" font-weight="700" letter-spacing="3">EGOLEPAY</text>',
            `<text x="170" y="122" font-size="11" font-weight="600" letter-spacing="1.6">${tag}</text>`,
            "</g></svg>",
        ].join("");
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    },
    _watermarkGhost() {
        const svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">',
            '<text x="320" y="150" text-anchor="middle" fill="#0F172A" fill-opacity="0.055"',
            ' font-family="Helvetica,Arial,sans-serif" font-size="86" font-weight="700" letter-spacing="8">EGOLEPAY</text>',
            "</svg>",
        ].join("");
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    },

    /* ---- the receipt document (rendered in the iframe, printed, downloaded) ---- */
    buildReceiptDocument(receipt, logoSrc) {
        const esc = (v) => this._esc(v);
        const money = (v) => this._formatMoney(v, receipt.currency);
        const tone = {
            success: { accent: "#0F9D58", soft: "#E8F5E9", label: "PAID" },
            failed: { accent: "#D93025", soft: "#FDECEA", label: "NOT PAID" },
            pending: { accent: "#F09300", soft: "#FFF4E0", label: "PENDING" },
            cancelled: { accent: "#5F6368", soft: "#F1F3F4", label: "CANCELLED" },
        }[receipt.status] || { accent: "#5F6368", soft: "#F1F3F4", label: esc(receipt.statusLabel) };
        const brandMark = logoSrc
            ? `<img class="brand-logo" src="${esc(logoSrc)}" alt="EgolePay">`
            : `<span class="brand-word">EGOLEPAY</span>`;
        const row = (label, value, opts = {}) => {
            if (value === null || value === undefined || value === "")
                return "";
            return `<div class="row${opts.strong ? " row-strong" : ""}">
            <div class="row-label">${esc(label)}</div>
            <div class="row-value${opts.mono ? " mono" : ""}">${esc(value)}</div>
          </div>`;
        };
        const metaRows = Object.keys(receipt.metadata || {})
            .filter((key) => {
                const value = receipt.metadata[key];
                return value !== null && value !== undefined && typeof value !== "object" && String(value).length <= 120;
            })
            .slice(0, 8)
            .map((key) => row(key, receipt.metadata[key]))
            .join("");
        const customer = receipt.customer || {};
        const externals = Array.isArray(receipt.externalReceipts) ? receipt.externalReceipts.filter((x) => x && x.url) : [];
        const externalRows = externals
            .map((x, i) => `<div class="row row-ext">
            <div class="row-label ext-name">${esc(x.label || `Receipt ${i + 1}`)}</div>
            <a class="ext-btn" href="${esc(x.url)}" target="_blank" rel="noopener" data-egp-ext="${i}">${externals.length === 1 ? "Download LIRS Receipt" : "Download"}</a>
          </div>`)
            .join("");
        return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EgolePay Receipt ${esc(receipt.gatewayReference || receipt.merchantReference)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: #EEF1F5;
    color: #0F172A;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    position: relative;
    max-width: 640px;
    margin: 18px auto;
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 4px;
    overflow: hidden;
  }

  /* ---- watermark layers: non-selectable, non-copyable, always printed ---- */
  .wm { position: absolute; inset: 0; pointer-events: none; user-select: none;
        -webkit-user-select: none; z-index: 0; }
  .wm-tile { background-image: url("${this._watermarkTile(receipt)}");
             background-repeat: repeat; background-size: 340px 210px; }
  .wm-ghost { background-image: url("${logoSrc ? esc(logoSrc) : this._watermarkGhost()}");
              background-repeat: no-repeat; background-position: center 46%;
              background-size: ${logoSrc ? "62%" : "78%"} auto;
              opacity: ${logoSrc ? "0.07" : "1"}; }
  .content { position: relative; z-index: 1; }

  .head { display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; padding: 22px 26px 16px; border-bottom: 1px solid #EDF1F6; }
  .brand-logo { height: 34px; width: auto; display: block; }
  .brand-word { font-size: 19px; font-weight: 800; letter-spacing: 2px; color: #0F172A; }
  .doc-title { font-size: 11px; font-weight: 700; letter-spacing: 1.4px;
               text-transform: uppercase; color: #64748B; margin-top: 7px; }
  .head-right { text-align: right; }
  .stamp { display: inline-block; padding: 6px 13px; border-radius: 4px;
           border: 2px solid ${tone.accent}; color: ${tone.accent};
           background: ${tone.soft}; font-size: 12px; font-weight: 800;
           letter-spacing: 1.6px; transform: rotate(-4deg); }
  .mode { display: block; margin-top: 8px; font-size: 10px; font-weight: 700;
          letter-spacing: 1.2px; color: #B45309; }

  .amount { padding: 22px 26px 18px; text-align: center; border-bottom: 1px dashed #E2E8F0; }
  .amount-label { font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: #94A3B8; }
  .amount-value { font-size: 34px; font-weight: 800; color: ${tone.accent}; margin-top: 5px;
                  letter-spacing: -0.5px; }
  .amount-desc { font-size: 13px; color: #475569; margin-top: 7px; }

  .section { padding: 16px 26px; border-bottom: 1px solid #F1F5F9; }
  .section:last-of-type { border-bottom: 0; }
  .section-title { font-size: 10px; font-weight: 700; letter-spacing: 1.3px;
                   text-transform: uppercase; color: #94A3B8; margin-bottom: 10px; }
  .row { display: flex; align-items: baseline; justify-content: space-between;
         gap: 18px; padding: 5px 0; }
  .row-label { font-size: 12.5px; color: #64748B; flex: 0 0 auto; }
  .row-value { font-size: 12.5px; color: #0F172A; font-weight: 600;
               text-align: right; word-break: break-word; }
  .row-strong .row-value { font-size: 14px; font-weight: 800; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 12px; letter-spacing: 0.2px; }

  /* ---- agency / LIRS receipts: one download per purchased item ---- */
  .row-ext { align-items: center; padding: 7px 0; border-bottom: 1px dashed #EDF1F6; }
  .row-ext:last-child { border-bottom: 0; }
  .ext-name { flex: 1 1 auto; color: #0F172A; font-weight: 600; word-break: break-word; }
  .ext-btn { flex: 0 0 auto; display: inline-block; padding: 5px 12px; border-radius: 3px;
             border: 1px solid #E07D00; background-color: #FF8C00; color: #FFFFFF;
             font-size: 12px; font-weight: 700; line-height: 1.42857; text-decoration: none;
             white-space: nowrap; -webkit-transition: background-color .15s ease-in-out;
             transition: background-color .15s ease-in-out; }
  .ext-btn:hover { background-color: #E67E00; border-color: #C46C00; }
  .ext-btn:active { -webkit-box-shadow: inset 0 3px 5px rgba(0,0,0,.125); box-shadow: inset 0 3px 5px rgba(0,0,0,.125); }
  .ext-note { font-size: 10.5px; color: #94A3B8; margin-top: 8px; line-height: 1.5; }

  .foot { padding: 16px 26px 22px; background: #F8FAFC; }
  .seal { display: flex; align-items: center; justify-content: space-between;
          gap: 14px; padding: 10px 13px; border: 1px dashed #CBD5E1;
          border-radius: 4px; background: #FFFFFF; }
  .seal-label { font-size: 10px; letter-spacing: 1.1px; text-transform: uppercase; color: #94A3B8; }
  .seal-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
               font-size: 14px; font-weight: 700; letter-spacing: 1.5px; color: #0F172A; }
  .note { margin-top: 12px; font-size: 10.5px; line-height: 1.6; color: #94A3B8; text-align: center; }

  @media print {
    html, body { background: #FFFFFF; }
    .sheet { margin: 0; border: 0; border-radius: 4px; max-width: none; }
    .ext-btn { background: #FFFFFF; color: #B45309; border: 1px solid #FDBA74; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="wm wm-tile" aria-hidden="true"></div>
    <div class="wm wm-ghost" aria-hidden="true"></div>

    <div class="content">
      <div class="head">
        <div>
          ${brandMark}
          <div class="doc-title">Payment Receipt</div>
        </div>
        <div class="head-right">
          <span class="stamp">${esc(receipt.statusLabel)}</span>
          ${receipt.mode === "TEST" ? '<span class="mode">TEST MODE - NOT A REAL PAYMENT</span>' : ""}
        </div>
      </div>

      <div class="amount">
        <div class="amount-label">${receipt.status === "success" ? "Amount Paid" : "Amount"}</div>
        <div class="amount-value">${esc(money(receipt.total))}</div>
        <div class="amount-desc">${esc(receipt.description)}</div>
      </div>

      ${externalRows ? `<div class="section">
        <div class="section-title">${esc(receipt.externalReceiptsTitle || "LIRS Receipts")}</div>
        ${externalRows}
        <div class="ext-note">Each item paid has its own agency receipt. Download and keep them together with this EgolePay receipt.</div>
      </div>` : ""}

      <div class="section">
        <div class="section-title">Transaction Details</div>
        ${row("Merchant Reference", receipt.merchantReference, { mono: true })}
        ${row("Payment Reference", receipt.paymentReference, { mono: true })}
        ${row("Description", receipt.description)}
        ${row("Payment Channel", receipt.channel)}
        ${row("Date & Time", receipt.paidAtLabel)}
        ${row("Status", receipt.statusLabel)}
        ${receipt.status !== "success" && receipt.message ? row("Reason", receipt.message) : ""}
      </div>

      <div class="section">
        <div class="section-title">Amount</div>
        ${row("Total", money(receipt.total), { strong: true })}
      </div>

      <div class="section">
        <div class="section-title">Payer</div>
        ${row("Name", customer.name)}
        ${row("Email", customer.email)}
        ${row("Phone", customer.phone)}
        ${receipt.card ? row("Card", receipt.card.maskedPan) : ""}
        ${receipt.bank ? row("Bank", receipt.bank.bankName) : ""}
        ${receipt.bank ? row("Account", receipt.bank.accountNumber) : ""}
      </div>

      ${metaRows ? `<div class="section"><div class="section-title">Additional Details</div>${metaRows}</div>` : ""}

      <div class="foot">
        <div class="seal">
          <span class="seal-label">Verification Code</span>
          <span class="seal-code">${esc(receipt.paymentReference || receipt.verificationCode)}</span>
        </div>
        <div class="note">
          This receipt was generated by EgolePay and is valid only with the verification
          code above. Any alteration to the amount, references or date voids it.<br>
          System generated, no signature required.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
    },

    /* ---- result modal (logo, status icon, inline e-Receipt, Print / Done) ---- */
    _injectReceiptStyles() {
        if (document.getElementById("egp-receipt-styles"))
            return;
        const style = document.createElement("style");
        style.id = "egp-receipt-styles";
        style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
#egp-result-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:92%;max-width:420px;max-height:92vh;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.18);z-index:10003;padding:28px 26px;text-align:center;font-family:'DM Sans',sans-serif;color:#0f172a;line-height:1.45;}
#egp-result-modal *{box-sizing:border-box;}
#egp-result-modal.egp-wide{max-width:560px;padding:24px 22px;}
#egp-result-modal img.egp-logo{max-width:170px;max-height:38px;display:block;margin:0 auto 18px;object-fit:contain;}
#egp-result-modal .egp-icon{width:56px;height:56px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:700;}
#egp-result-modal h3{margin:0 0 8px;font-size:18px;font-weight:700;color:#0f172a;}
#egp-result-modal p.egp-sub{margin:0 0 18px;font-size:13px;color:#64748b;}
#egp-result-modal .egp-ref{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:16px;text-align:left;}
#egp-result-modal .egp-ref-line{display:flex;justify-content:space-between;gap:12px;padding:4px 0;}
#egp-result-modal .egp-ref-key{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;flex:0 0 auto;font-weight:600;}
#egp-result-modal .egp-ref-val{font-size:12.5px;font-weight:600;color:#0f172a;text-align:right;word-break:break-all;}
#egp-result-modal .egp-actions{display:flex;flex-direction:column;gap:8px;}
#egp-result-modal button{display:block;width:100%;padding:10px 16px;border:1px solid transparent;border-radius:3px;font-size:14px;line-height:1.42857;font-weight:600;text-align:center;cursor:pointer;font-family:'DM Sans',sans-serif;-webkit-transition:background-color .15s ease-in-out,border-color .15s ease-in-out;transition:background-color .15s ease-in-out,border-color .15s ease-in-out;}
#egp-result-modal button:active{-webkit-box-shadow:inset 0 3px 5px rgba(0,0,0,.125);box-shadow:inset 0 3px 5px rgba(0,0,0,.125);}
#egp-result-modal button:focus{outline:thin dotted;outline:5px auto -webkit-focus-ring-color;outline-offset:-2px;}
#egp-result-modal .egp-btn-done{background-color:#5cb85c;border-color:#4cae4c;color:#fff;}
#egp-result-modal .egp-btn-done:hover{background-color:#449d44;border-color:#398439;}
#egp-result-modal .egp-btn-done.egp-neutral{background-color:#555;border-color:#444;}
#egp-result-modal .egp-btn-done.egp-neutral:hover{background-color:#444;border-color:#333;}
#egp-result-modal .egp-btn-primary{background-color:#ff8c00;border-color:#e07d00;color:#fff;}
#egp-result-modal .egp-btn-primary:hover{background-color:#e67e00;border-color:#c46c00;}
#egp-result-modal .egp-btn-ghost{background-color:#fff;border-color:#ccc;color:#333;}
#egp-result-modal .egp-btn-ghost:hover{background-color:#e6e6e6;border-color:#adadad;}
#egp-result-modal .egp-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
#egp-result-modal .egp-row2 button{min-width:0;}
#egp-result-modal .egp-receipt-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:4px 0 8px;padding-top:14px;border-top:1px solid #f1f5f9;text-align:left;}
#egp-result-modal .egp-receipt-head strong{font-size:12px;letter-spacing:.5px;color:#64748b;text-transform:uppercase;font-weight:700;}
#egp-result-modal iframe#egp-receipt-frame{width:100%;height:46vh;min-height:300px;border:1.5px solid #e2e8f0;border-radius:10px;background:#f8fafc;display:block;margin-bottom:12px;}
#egp-result-modal .egp-toast{font-size:12px;color:#22c55e;min-height:16px;margin:2px 0 8px;}
#egp-result-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10002;}
@media(max-width:640px){#egp-result-modal .egp-row2{grid-template-columns:1fr;}}
@media print{#egp-result-modal .egp-actions,#egp-result-modal .egp-toast{display:none;}}`;
        document.head.appendChild(style);
    },
    _resultTone(status) {
        return {
            success: { color: "#0F9D58", glyph: "✓", title: "Payment successful", sub: "Your transaction was completed successfully." },
            failed: { color: "#D93025", glyph: "!", title: "Payment not completed", sub: "This transaction did not go through." },
            pending: {
                color: "#F09300",
                glyph: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/></svg>',
                title: "Payment pending",
                sub: "We have not confirmed this payment yet.",
            },
            cancelled: { color: "#5F6368", glyph: "✕", title: "Payment cancelled", sub: "The payment was cancelled." },
        }[status] || { color: "#5F6368", glyph: "•", title: "Transaction closed", sub: "" };
    },
    /* Mounts the modal. `receipt` may be null (no e-Receipt pane, e.g. a
     * failure before any transaction existed). Returns the modal node.
     *   { status, title, message, receipt, retry, retryLabel, onDone, doneLabel, backdrop } */
    _mountResultModal(options = {}) {
        const status = options.status || "success";
        const tone = this._resultTone(status);
        const receipt = options.receipt || null;
        const esc = (v) => this._esc(v);
        this._injectReceiptStyles();
        ["egp-result-modal", "egp-result-backdrop"].forEach((id) => {
            const node = document.getElementById(id);
            if (node)
                node.remove();
        });
        this._receipt = receipt;
        this._receiptHtml = null;
        if (options.backdrop !== false && !document.getElementById("payment-overlay") && !document.getElementById("egp-backdrop")) {
            const backdrop = document.createElement("div");
            backdrop.id = "egp-result-backdrop";
            document.body.appendChild(backdrop);
        }
        const modal = document.createElement("div");
        modal.id = "egp-result-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", `${options.title || tone.title} - EgolePay`);
        const retryable = typeof options.retry === "function";
        modal.innerHTML = `
      <img class="egp-logo" src="${esc(this.companyLogo)}" alt="EgolePay" onerror="this.style.display='none'">
      <div class="egp-icon" style="background:${tone.color}">${tone.glyph}</div>
      <h3>${esc(options.title || tone.title)}</h3>
      <p class="egp-sub">${esc(options.message || tone.sub)}</p>
      ${receipt ? `<div class="egp-receipt-head">
        <strong>e-Receipt</strong>
        <span class="egp-ref-val">${esc(receipt.verificationCode || "")}</span>
      </div>
      <iframe id="egp-receipt-frame" title="EgolePay e-Receipt" sandbox="allow-same-origin allow-modals"></iframe>` : ""}
      <div class="egp-toast" id="egp-toast" role="status" aria-live="polite"></div>
      <div class="egp-actions">
        ${retryable ? `<button type="button" id="egp-retry" class="egp-btn-primary">${esc(options.retryLabel || (status === "pending" ? "Check Again" : "Try Again"))}</button>` : ""}
        ${receipt ? `<button type="button" id="egp-print" class="egp-btn-ghost">Print as PDF</button>` : ""}
        <button type="button" id="egp-done" class="egp-btn-done${status === "success" ? "" : " egp-neutral"}">${esc(options.doneLabel || "Done")}</button>
      </div>`;
        if (receipt)
            modal.classList.add("egp-wide");
        document.body.appendChild(modal);
        if (receipt)
            this._renderInlineReceipt(receipt);
        const bind = (id, handler) => {
            const node = document.getElementById(id);
            if (node)
                node.addEventListener("click", handler);
        };
        bind("egp-done", () => {
            if (typeof options.onDone === "function")
                options.onDone();
        });
        bind("egp-print", () => this.printReceipt());
        if (retryable)
            bind("egp-retry", () => options.retry());
        const focusTarget = document.getElementById("egp-done");
        if (focusTarget)
            focusTarget.focus();
        return modal;
    },
    _removeResultModal() {
        ["egp-result-modal", "egp-result-backdrop"].forEach((id) => {
            const node = document.getElementById(id);
            if (node)
                node.remove();
        });
    },

    /* ---- receipt actions ---- */
    async _renderInlineReceipt(receipt) {
        const frame = document.getElementById("egp-receipt-frame");
        if (!frame || frame.dataset.rendered === "1")
            return;
        const logo = await this._resolveLogo();
        this._receiptHtml = this.buildReceiptDocument(receipt, logo || this.companyLogo);
        this._receiptReady = new Promise((resolve) => {
            frame.addEventListener("load", () => resolve(), { once: true });
            setTimeout(resolve, 2500);
        });
        // The agency download buttons live inside the receipt. The frame is
        // sandboxed without popups, so route the click through this window
        // (same-origin srcdoc, so the document is reachable) and keep the
        // mobile-aware opener in one place.
        frame.addEventListener("load", () => {
            try {
                const doc = frame.contentDocument;
                if (!doc)
                    return;
                doc.addEventListener("click", (e) => {
                    const link = e.target && e.target.closest ? e.target.closest("a[data-egp-ext]") : null;
                    if (!link)
                        return;
                    e.preventDefault();
                    this._openExternalReceipt(link.getAttribute("href"));
                });
            }
            catch (err) {
            }
        }, { once: true });
        frame.srcdoc = this._receiptHtml;
        frame.dataset.rendered = "1";
    },
    async _ensureReceiptHtml() {
        if (this._receiptHtml)
            return this._receiptHtml;
        const receipt = this._receipt || (typeof this.buildReceipt === "function"
            ? this.buildReceipt(this.currentStep === "success" ? "success" : "pending")
            : null);
        if (!receipt)
            throw new Error("No receipt to render");
        const logo = await this._resolveLogo();
        this._receiptHtml = this.buildReceiptDocument(receipt, logo || this.companyLogo);
        return this._receiptHtml;
    },
    async printReceipt() {
        const html = await this._ensureReceiptHtml();
        const mounted = document.getElementById("egp-receipt-frame");
        const fire = (frame) => {
            try {
                frame.contentWindow.focus();
                frame.contentWindow.print();
            }
            catch (err) {
                this._toast("Could not open the print dialog", true);
            }
        };
        if (mounted && mounted.dataset.rendered === "1") {
            if (this._receiptReady)
                await this._receiptReady;
            fire(mounted);
            return;
        }
        const hidden = document.createElement("iframe");
        hidden.id = "egp-print-frame";
        hidden.setAttribute("sandbox", "allow-same-origin allow-modals");
        hidden.setAttribute("aria-hidden", "true");
        hidden.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
        hidden.addEventListener("load", () => {
            fire(hidden);
            setTimeout(() => hidden.parentNode && hidden.parentNode.removeChild(hidden), 60000);
        });
        document.body.appendChild(hidden);
        hidden.srcdoc = html;
    },
    async downloadReceipt() {
        try {
            const html = await this._ensureReceiptHtml();
            const receipt = this._receipt || {};
            const name = `EgolePay-Receipt-${(receipt.gatewayReference || receipt.merchantReference || "transaction").replace(/[^A-Za-z0-9_-]/g, "")}.html`;
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            this._objectUrls = this._objectUrls || [];
            this._objectUrls.push(url);
            const link = document.createElement("a");
            link.href = url;
            link.download = name;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this._toast("Receipt downloaded");
        }
        catch (err) {
            this._toast("Could not download the receipt", true);
        }
    },
    _toast(message, isError) {
        const node = document.getElementById("egp-toast");
        if (!node)
            return;
        node.textContent = message;
        node.style.color = isError ? "#D93025" : "#0F9D58";
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            if (node.isConnected)
                node.textContent = "";
        }, 2600);
    },
    _releaseReceiptResources() {
        (this._objectUrls || []).forEach((url) => {
            try {
                URL.revokeObjectURL(url);
            }
            catch (err) {
            }
        });
        this._objectUrls = [];
        clearTimeout(this._toastTimer);
        const frame = document.getElementById("egp-print-frame");
        if (frame)
            frame.remove();
    },
};
/* EGP-RECEIPT-END */

class EgolePay {

    /* ---- Initialization ---- */
    constructor(options = {}) {
        this.options = options;
        const labels = {
            apiKey: "apiKey is required (use sk_test_xxx for test or sk_live_xxx for live)",
            amount: "amount is required",
            email: "email is required",
            txnRef: "order / transaction ref is required",
        };
        for (const field in labels) if (!options[field]) throw new Error(labels[field]);
        this.apiKey = options.apiKey;
        this.isTestMode = String(options.apiKey || "").startsWith("sk_test_");
        this.baseUrl = options.baseUrl || BASE_URL;
        this.amount = options.amount;
        this.currency = options.currency || "NGN";
        this.email = options.email || "";
        this.phone = options.phone || "";
        this.saveCard = options.saveCard === true;
        this.reference = options.txnRef || this.generateReference("TXN");
        this.metadata = options.metadata || {};
        this.customerName =
            options.customerName || String(options.email || "").split("@")[0] || "";
        this.merchantName = options.merchantName || "";
        this.description =
            options.description ||
                options.narration ||
                (options.metadata && options.metadata.description) ||
                "Payment";
        this.onSuccess = options.onSuccess;
        this.onError = options.onError;
        this.onCancel = options.onCancel;
        this.onPending = options.onPending;
        this.onAttempt = options.onAttempt;
        this.onNotice = options.onNotice;
        this.onClose = options.onClose;
        this.onStepChange = options.onStepChange;
        this.companyLogo = options.logo || EgolePayAssets.logo;
        this.currentStep = "initial";
        this.transactionReference = null;
        this.paymentReference = null;
        this.totalAmount = 0;
        this.serviceFee = 0;
        this.selectedItemsData = [];
        this.paymentChannel = "";
        this._extras = {};
        this.cardSummary = null;
        this.transferSummary = null;
        this._listeners = {};
        this._settled = false;
        this._closed = false;
        this._result = null;
        this._receipt = null;
        this._receiptHtml = null;
        this._pendingOutcome = null;
        this._pendingMessage = "";
        this._objectUrls = [];
        this._done = new Promise((resolve) => {
            this._resolveDone = resolve;
        });
        this.encryptPayloads = options.encryptPayloads === true;
        try {
            this.encryption = new PayloadEncryption(options.rsaPublicKey || null);
        }
        catch (err) {
            this.encryption = null;
        }
        this.handleEscKey = this.handleEscKey.bind(this);
        this.init();
    }

    /* ---- HTTP ---- */
    async encryptPayload(payload) {
        if (!this.encryption)
            throw new Error("Encryption utility not initialized");
        if (typeof this.encryption.isSupported !== "function")
            throw new Error("Encryption utility malformed");
        if (!this.encryption.isSupported())
            throw new Error("This browser cannot secure card data. Please use a modern browser.");
        return await this.encryption.encrypt(payload);
    }
    async _post(path, body, options = {}) {
        let payload = body;
        if (options.secure) {
            if (this.encryptPayloads !== false) {
                const sealed = await this.encryptPayload(options.secure);
                payload = { ...body, payload: sealed.encryptedData };
            }
            else {
                payload = { ...body, ...options.secure };
            }
        }
        const url = /^https?:\/\//i.test(path) ? path : `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), options.timeout || 45000);
        let response;
        try {
            response = await fetch(url, {
                method: options.method || "POST",
                headers: {
                    ...{
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    ...(options.headers || {}),
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
                credentials: "omit",
                referrerPolicy: "no-referrer",
            });
        }
        catch (err) {
            throw new Error(err.name === "AbortError"
                ? "The request timed out. Please check your connection and try again."
                : "Could not reach the payment gateway. Please try again.");
        }
        finally {
            clearTimeout(timer);
            payload = null;
        }
        const text = await response.text();
        let json = {};
        try {
            json = text ? JSON.parse(text) : {};
        }
        catch (err) {
            throw new Error("The payment gateway returned an unreadable response.");
        }
        const env = this._envelope(json);
        if (!response.ok)
            throw new Error(env.message || `Request failed (${response.status})`);
        return json;
    }
    _scrub(holder, ...keys) {
        if (!holder)
            return;
        keys.forEach((key) => {
            if (typeof holder[key] === "string")
                holder[key] = "\u0000".repeat(holder[key].length);
            delete holder[key];
        });
    }
    _shapeFields(shape, values) {
        const shaped = {};
        Object.keys(shape).forEach((key) => {
            if (values[key] !== undefined)
                shaped[shape[key]] = values[key];
        });
        return shaped;
    }
    _extraFieldsFor(channel) {
        const fields = [];
        return Array.isArray(fields) ? fields.filter(Boolean) : [];
    }
    _extraFieldsMarkup(fields) {
        const esc = (v) => this._esc(v);
        return fields
            .map((field) => `
            <label class="egp-label" for="egp-x-${esc(field.id)}">${esc(field.label)}</label>
            <input type="${esc(field.type || "text")}" id="egp-x-${esc(field.id)}" class="egp-input"
                   placeholder="${esc(field.placeholder || "")}" value="${esc(field.value == null ? "" : field.value)}"
                   autocomplete="off" spellcheck="false" aria-label="${esc(field.label)}">`)
            .join("");
    }
    _readExtraFields(fields) {
        const values = {};
        for (const field of fields) {
            const node = document.getElementById(`egp-x-${field.id}`);
            values[field.id] = node ? String(node.value || "").trim() : "";
        }
        for (const field of fields) {
            if (typeof field.validate !== "function")
                continue;
            const invalid = field.validate(values[field.id], this, values);
            if (invalid) {
                this.showErrorModal(invalid);
                return null;
            }
        }
        this._extras = { ...(this._extras || {}), ...values };
        return this._extras;
    }
    _scrubField(id) {
        const field = document.getElementById(id);
        if (!field)
            return;
        field.value = "";
        field.setAttribute("value", "");
    }

    /* ---- Validation ---- */
    _luhnValid(pan) {
        let sum = 0;
        let double = false;
        for (let i = pan.length - 1; i >= 0; i--) {
            let digit = pan.charCodeAt(i) - 48;
            if (digit < 0 || digit > 9)
                return false;
            if (double) {
                digit *= 2;
                if (digit > 9)
                    digit -= 9;
            }
            sum += digit;
            double = !double;
        }
        return sum % 10 === 0;
    }
    validateCardInformation(pan, expiry, cvv, pin) {
        const digits = String(pan || "").replace(/\s/g, "");
        if (!/^\d{13,20}$/.test(digits))
            return "Please enter a valid card number.";
        if (!this._luhnValid(digits))
            return "That card number does not look right.";
        const match = /^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.exec(String(expiry || "").trim());
        if (!match)
            return "Please enter the expiry date as MM/YY.";
        const month = Number(match[1]);
        const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
        const endOfMonth = new Date(year, month, 1) - 1;
        if (endOfMonth < Date.now())
            return "That card has expired.";
        if (!/^\d{3,4}$/.test(String(cvv || "")))
            return "Please enter a valid CVV.";
        if (pin !== undefined && !/^\d{4}$/.test(String(pin || "")))
            return "Please enter your 4-digit card PIN.";
        return null;
    }

    /* ---- Helpers ---- */
    generateReference(e = "TXN") {
        return `${e}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }
    generateRandomString(e = 8) {
        const t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        let n = "";
        for (let o = 0; o < e; o++)
            n += t.charAt(Math.floor(52 * Math.random()));
        return n;
    }
    removeCommas(e) {
        return Number.parseFloat(String(e).replace(/,/g, ""));
    }
    convertToNumber(e) {
        if (null == e)
            return null;
        const t = Number.parseFloat(e.toString().replace(/,/g, ""));
        return isNaN(t) ? null : t;
    }
    formatCurrency(e) {
        return `₦${Number.parseFloat(e).toLocaleString(void 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    maskCardNumber(e) {
        return e.replace(/.(?=.{4})/g, "*");
    }
    getBankName(e) {
        return ({
            "044": "Access Bank Nigeria Plc",
            "063": "Diamond Bank Plc",
            "050": "Ecobank Nigeria",
            "084": "Enterprise Bank Plc",
            "070": "Fidelity Bank Plc",
            "011": "First Bank of Nigeria Plc",
            214: "First City Monument Bank",
            "058": "Guaranty Trust Bank Plc",
            "030": "Heritage Banking Company Ltd",
            301: "Jaiz Bank",
            "082": "Keystone Bank Ltd",
            "014": "Mainstreet Bank Plc",
            "076": "Skye Bank Plc",
            "039": "Stanbic IBTC Plc",
            232: "Sterling Bank Plc",
            "032": "Union Bank Nigeria Plc",
            "033": "United Bank for Africa Plc",
            215: "Unity Bank Plc",
            "035": "WEMA Bank Plc",
            "057": "Zenith Bank International",
        }[e] || e);
    }

    /* ---- Create transaction endpoint: POST /transactions ---- */
    async createTransaction() {
        this.showOverlay("Creating transaction...");
        const e = {
            amount: this.amount,
            reference: this.reference,
            customer: {
                email: this.email,
                name: this.customerName,
                phone: this.phone,
            },
            metadata: this.metadata,
        };
        try {
            const n = await this._post("/transactions", e);
            const envelope = this._envelope(n);
            if (!envelope.ok)
                throw new Error(envelope.message || "Transaction creation failed");
            {
                const e = envelope.data;
                if (!e)
                    throw new Error("No data returned from API");
                const opened = {
                    reference: e.reference || e.Reference,
                    totalAmount: e.totalAmount || e.TotalAmount,
                    fee: e.fee || e.Fee,
                };
                ((this.transactionReference = opened.reference),
                    (this.totalAmount = opened.totalAmount),
                    (this.serviceFee = opened.fee),
                    this.hideOverlay(),
                    this.showPaymentOptionsPopup());
            }
        }
        catch (err) {
            this.hideOverlay();
            this.showResultModal({
                status: "failed",
                title: "Could not start this payment",
                message: err.message || "Failed to initialize payment. Please try again.",
                retry: () => this.createTransaction(),
            });
        }
    }

    /* ---- Card endpoint: POST /transactions/{ref}/payments/card ----
     * Body: { Amount, Email, Phone, Card: { Number, Cvv, ExpiryMonth, ExpiryYear, Pin }, Description, SaveCard }
     */
    async processCardPayment(e) {
        this.showOverlay("Processing card payment...");
        this.paymentChannel = "Card";
        this.cardSummary =
            e && e.number
                ? {
                    maskedPan: `**** **** **** ${String(e.number).replace(/\s/g, "").slice(-4)}`,
                }
                : null;
        const routing = {
            Amount: this.amount,
            Email: this.email,
            Phone: this.phone,
            Description: e.description || this.description || "Card payment",
            SaveCard: this.saveCard,
        };
        const shape = null;
        const secure = shape
            ? this._shapeFields(shape, {
                number: String(e.number || "").replace(/\s/g, ""),
                expiry: `${e.expiryMonth || ""}/${e.expiryYear || ""}`,
                expiryMonth: e.expiryMonth,
                expiryYear: e.expiryYear,
                cvv: e.cvv,
                pin: e.pin,
                amount: this.amount,
                email: this.email,
                reference: this.transactionReference,
            })
            : {
                Card: {
                    Number: String(e.number || "").replace(/\s/g, ""),
                    Cvv: e.cvv,
                    ExpiryMonth: e.expiryMonth,
                    ExpiryYear: e.expiryYear,
                    Pin: e.pin,
                },
            };
        Object.assign(routing, {} || {});
        try {
            const n = await this._post(`/transactions/${this.transactionReference}/payments/card`, routing, { secure });
            const env = this._envelope(n);
            if ((this.hideOverlay(), env.ok)) {
                const data = env.data;
                const charged = {
                    requires3DS: !0 === data.Requires3DS && Boolean(data.ThreeDSecure),
                    threeDS: data.ThreeDSecure || null,
                    authData: null,
                    paymentReference: data.PaymentReference,
                    gatewayReference: this._field(data, "TransactionReference", "transactionReference"),
                    outcome: this._outcomeOf(this._field(data, "Status", "status", "ResponseCode", "responseCode")),
                    message: data.Message || data.message || "Payment failed. Please try again.",
                };
                if (charged.requires3DS)
                    this.showOtpPopup(charged.paymentReference, charged.threeDS);
                else if ("success" === charged.outcome) {
                    this.paymentReference = charged.paymentReference;
                    if (charged.gatewayReference)
                        this.transactionReference = charged.gatewayReference;
                    this.showResultModal({
                        status: "success",
                        channel: "Card",
                        paymentReference: charged.paymentReference,
                    });
                }
                else if ("pending" === charged.outcome)
                    this.showOtpPopup(charged.paymentReference, charged.authData || null);
                else
                    this.showResultModal({
                        status: "failed",
                        channel: "Card",
                        paymentReference: charged.paymentReference,
                        message: charged.message,
                        retry: () => this.showCardPaymentForm(),
                    });
            }
            else {
                const e = n.Message || n.message || "Payment failed. Please try again.", t = n.Errors;
                if (t && Object.keys(t).length > 0) {
                    const first = Object.values(t)[0];
                    this.showCardPaymentForm();
                    this.showErrorModal(Array.isArray(first) ? first[0] : first);
                }
                else
                    this.showResultModal({
                        status: "failed",
                        channel: "Card",
                        message: e,
                        retry: () => this.showCardPaymentForm(),
                    });
            }
        }
        catch (err) {
            this.hideOverlay();
            this.showResultModal({
                status: "failed",
                channel: "Card",
                message: err.message || "Card payment failed. Please try again.",
                retry: () => this.showCardPaymentForm(),
            });
        }
        finally {
            if (shape)
                this._scrub(secure, ...Object.keys(secure));
            else
                this._scrub(secure.Card, "Number", "Cvv", "Pin");
            this._scrub(e, "number", "cvv", "pin");
        }
    }

    /* ---- Transfer endpoint: POST /transactions/{ref}/transfers/initiate, verify: POST /transactions/{ref}/{payRef}/transfers/verify ---- */
    async initiateTransfer() {
        this.showOverlay("Generating transfer account...");
        this.paymentChannel = "Bank Transfer";
        try {
            const t = await this._post(`/transactions/${this.transactionReference}/transfers/initiate`, {});
            const env = this._envelope(t);
            if (!env.ok)
                throw new Error(env.message || "Transfer initiation failed");
            {
                this.hideOverlay();
                const e = env.data;
                this.paymentReference = e.TransferReference;
                this.transferSummary = {
                    bankName: e.BankName,
                    accountNumber: e.AccountNumber,
                    accountName: e.AccountName,
                };
                this.showTransferDetailsPopup(e);
            }
        }
        catch (err) {
            this.hideOverlay();
            this.showResultModal({
                status: "failed",
                channel: "Bank Transfer",
                message: err.message || "Failed to initiate transfer. Please try again.",
                retry: () => this.showPaymentOptionsPopup(),
            });
        }
    }
    async verifyTransfer(e, t) {
        const sourceAccount = e;
        const receiptEmail = t;
        this._lastVerifyArgs = [sourceAccount, receiptEmail];
        this.showOverlay("Verifying payment...");
        this.paymentChannel = "Bank Transfer";
        const n = this.paymentReference || this.transactionReference, o = { SourceAcct: e };
        try {
            const body = await this._post(`/transactions/${this.transactionReference}/${n}/transfers/verify`, o);
            const env = this._envelope(body);
            if (!env.ok)
                throw new Error(env.message || "Verification failed");
            const r = env.data;
            const gatewayRef = this._field(r, "TransactionReference", "transactionReference");
            if (gatewayRef)
                this.transactionReference = gatewayRef;
            const i = this._outcomeOf(this._field(r, "Status", "status"));
            this.hideOverlay();
            if ("success" === i)
                this.showResultModal({
                    status: "success",
                    channel: "Bank Transfer",
                    title: "Payment verified successfully!",
                    paymentReference: this._field(r, "PaymentReference", "paymentReference", "TransferReference", "transferReference") || this.paymentReference,
                });
            else if ("pending" === i)
                this.showResultModal({
                    status: "pending",
                    channel: "Bank Transfer",
                    message: this._field(r, "Message", "message") ||
                        "We have not seen this transfer yet. If you have already paid, give it a moment and check again.",
                    retry: () => this.verifyTransfer(sourceAccount, receiptEmail),
                });
            else
                this.showResultModal({
                    status: "failed",
                    channel: "Bank Transfer",
                    message: this._field(r, "Message", "message") ||
                        "We could not verify this payment.",
                    retry: () => this._lastTransferDetails
                        ? this.showTransferDetailsPopup(this._lastTransferDetails)
                        : this.verifyTransfer(sourceAccount, receiptEmail),
                });
        }
        catch (err) {
            this.hideOverlay();
            this.showResultModal({
                status: "pending",
                channel: "Bank Transfer",
                title: "We could not confirm your payment",
                message: err.message ||
                    "Verification did not complete. If you have paid, check again in a moment.",
                retry: () => this.verifyTransfer(sourceAccount, receiptEmail),
            });
        }
    }

    /* ---- UI: transfer details ---- */
    showTransferDetailsPopup(e) {
        this._lastTransferDetails = e;
        const esc = (v) => this._esc(v);
        (this.updateStep("transfer_details"), this.removePopup("payment-popup"));
        this._injectStyles();
        const extras = this._extraFieldsFor("transfer");
        document.body.appendChild(this.createOverlay());
        const expiresAt = e.ExpiresAt ? new Date(e.ExpiresAt) : null;
        const expiryDate = expiresAt && !isNaN(expiresAt.getTime()) ? expiresAt.toLocaleString() : "";
        const popup = document.createElement("div");
        popup.id = "payment-popup";
        popup.innerHTML = this._shell(`
          <button class="egp-close" id="cancel-transfer" aria-label="Close" title="Close">&times;</button>
          <div class="egp-main-header">
            <h2>Complete your payment</h2>
            <p>Choose a payment method below</p>
          </div>
          ${this._tabs("transfer")}
          <div class="egp-panels">
            <h3 class="egp-title">Bank Transfer</h3>
            <p class="egp-subtitle">Transfer the exact amount to the account below</p>

            <div class="egp-warn">Transfer the exact amount shown below</div>

            <div class="egp-bank-box">
              <div class="egp-bank-row">
                <span class="lbl">Bank Name</span>
                <span class="val">${esc(e.BankName)}</span>
              </div>
              <div class="egp-bank-row">
                <span class="lbl">Account Number</span>
                <span class="val">
                  <span id="account-number">${esc(e.AccountNumber)}</span>
                  <button type="button" class="egp-copy-btn" id="copy-account" title="Copy to clipboard">Copy</button>
                </span>
              </div>
              <div class="egp-bank-row">
                <span class="lbl">Account Name</span>
                <span class="val">${esc(e.AccountName)}</span>
              </div>
              <div class="egp-bank-row">
                <span class="lbl">Amount</span>
                <span class="val accent">${esc(this._formatMoney(e.Amount))}</span>
              </div>
            </div>

            <div class="egp-bank-box">
              <div class="egp-bank-row">
                <span class="lbl">Expires In</span>
                <span class="val">${esc(e.ExpiryTime)}</span>
              </div>
              ${expiryDate
            ? `<div class="egp-bank-row">
                     <span class="lbl">Expiry Date</span>
                     <span class="val">${esc(expiryDate)}</span>
                   </div>`
            : ""}
            </div>

            ${extras.length
            ? this._extraFieldsMarkup(extras)
            : `<label class="egp-label" for="verify-email">Email for receipt</label>
            <input type="email" id="verify-email" class="egp-input" value="${esc(this.email)}"
                   autocomplete="email" required aria-label="Email for receipt">`}

            <button class="egp-btn egp-btn-primary" type="button" id="verify-transfer">I Have Paid</button>

            <div class="egp-secure-note">Your payment is secured with encryption</div>
          </div>`);
        document.body.appendChild(popup);
        this._bindTabs("transfer");
        document.getElementById("copy-account").addEventListener("click", () => {
            const value = document.getElementById("account-number").textContent;
            navigator.clipboard.writeText(value).then(() => {
                const button = document.getElementById("copy-account");
                (button.classList.add("copied"),
                    (button.textContent = "Copied"),
                    setTimeout(() => {
                        (button.classList.remove("copied"), (button.textContent = "Copy"));
                    }, 2e3));
            });
        });
        document.getElementById("verify-transfer").addEventListener("click", () => {
            let t;
            if (extras.length) {
                const values = this._readExtraFields(extras);
                if (!values)
                    return;
                t = values.email || this.email;
            }
            else {
                t = document.getElementById("verify-email").value;
                if (!t || !t.includes("@"))
                    return void this.showErrorModal("Please enter a valid email");
            }
            (this.removePopup("payment-popup"),
                this.removePopup("payment-overlay"),
                this.verifyTransfer(e.AccountNumber, t));
        });
        document.getElementById("cancel-transfer").addEventListener("click", () => {
            (this.removePopup("payment-popup"),
                this.removePopup("payment-overlay"),
                this.handleCancel());
        });
    }

    /* ---- Response parsing ---- */
    _envelope(json) {
        const body = json || {};
        const data = body.Data !== undefined ? body.Data : body.data;
        return {
            ok: !0 === body.Status || !0 === body.status,
            message: body.Message || body.message || "",
            data: data || {},
            errors: body.Errors || body.errors || null,
        };
    }
    _field(source, ...names) {
        if (!source)
            return undefined;
        for (const name of names) {
            const value = source[name];
            if (value !== undefined && value !== null && value !== "")
                return value;
        }
        return undefined;
    }
    _outcomeOf(value) {
        const token = String(value === true ? "success" : value || "").toLowerCase();
        if (["success", "successful", "completed", "approved", "paid", "00"].includes(token))
            return "success";
        if (["pending", "processing", "in_progress", "inprogress", "02", "t0"].includes(token))
            return "pending";
        return "failed";
    }

    /* ---- OTP endpoint: POST /transactions/{ref}/payments/card/otp ---- */
    async confirmOtp(otp, paymentReference, authData = null) {
        const e = otp, t = paymentReference, n = authData;
        this.showOverlay("Verifying OTP...");
        const routing = { paymentReference: t, authData: n, email: this.email };
        const shape = null;
        const secure = shape
            ? this._shapeFields(shape, {
                otp: e,
                paymentReference: t,
                authData: n,
                email: this.email,
            })
            : { paymentReference: t, otp: e, authData: n, email: this.email };
        try {
            const body = await this._post(`/transactions/${this.transactionReference}/payments/card/otp`, routing, { secure });
            const env = this._envelope(body);
            this.hideOverlay();
            if (!env.ok) {
                this.showErrorModal(env.message || "OTP verification failed. Please try again.");
                return;
            }
            const data = env.data;
            const gatewayRef = this._field(data, "TransactionReference", "transactionReference");
            if (gatewayRef)
                this.transactionReference = gatewayRef;
            const payRef = this._field(data, "PaymentReference", "paymentReference") ||
                t ||
                this.paymentReference;
            if (payRef)
                this.paymentReference = payRef;
            const message = this._field(data, "Message", "message") || env.message;
            const outcome = this._outcomeOf(this._field(data, "Status", "status", "ResponseCode", "responseCode"));
            if ("success" === outcome)
                this.showResultModal({
                    status: "success",
                    channel: "Card",
                    title: "Payment verified successfully!",
                    paymentReference: payRef,
                });
            else if ("pending" === outcome)
                this.showResultModal({
                    status: "pending",
                    channel: "Card",
                    message: message || "This payment has not been confirmed yet.",
                    retry: () => this.confirmOtp(e, t, n),
                });
            else
                this.showErrorModal(message || "OTP verification failed. Please try again.");
        }
        catch (err) {
            this.hideOverlay();
            this.showErrorModal(err.message || "OTP verification failed. Please try again.");
        }
        finally {
            this._scrub(secure, ...Object.keys(secure));
        }
    }

    /* ---- Lifecycle ---- */
    async init() {
        document.addEventListener("keydown", this.handleEscKey);
        try {
            const proceed = await true;
            if (proceed === false)
                return;
        }
        catch (err) {
            this.hideOverlay();
            this.showResultModal({
                status: "failed",
                title: "Could not start this payment",
                message: err.message || "Failed to prepare the payment.",
            });
            return;
        }
        this.createTransaction();
    }
    createOverlay() {
        const existing = document.getElementById("payment-overlay");
        if (existing)
            return existing;
        const e = document.createElement("div");
        return ((e.id = "payment-overlay"),
            (e.style.position = "fixed"),
            (e.style.top = "0"),
            (e.style.left = "0"),
            (e.style.width = "100%"),
            (e.style.height = "100%"),
            (e.style.backgroundColor = "rgba(15, 23, 42, 0.55)"),
            (e.style.zIndex = "1000"),
            e);
    }
    showOverlay(e) {
        this.removePopup("processing-overlay");
        this._injectStyles();
        const t = document.createElement("div");
        ((t.id = "processing-overlay"),
            (t.style.cssText =
                "position:fixed;top:0;left:0;width:100%;height:100%;" +
                    "background:rgba(15,23,42,.55);z-index:1002;display:flex;" +
                    "justify-content:center;align-items:center;"),
            (t.innerHTML = `
      <div class="egp-load">
        <div class="egp-load-msg">${this._esc(e)}</div>
        <div class="egp-spin"></div>
      </div>`),
            document.body.appendChild(t));
    }
    hideOverlay() {
        this.removePopup("processing-overlay");
    }
    static get POPUP_IDS() {
        return [
            "payment-popup",
            "otp-popup",
            "payment-overlay",
            "error-modal",
            "success-popup",
            "processing-overlay",
            "egp-result-modal",
        ];
    }
    removePopup(id) {
        for (;;) {
            const node = document.getElementById(id);
            if (!node || !node.parentNode)
                break;
            node.parentNode.removeChild(node);
        }
    }
    removeAllPopups() {
        EgolePay.POPUP_IDS.forEach((id) => this.removePopup(id));
    }
    updateStep(step, data = {}) {
        const previousStep = this.currentStep;
        this.currentStep = step;
        this._emit("step", { previousStep, currentStep: step, data });
    }

    /* ---- Events ---- */
    on(event, handler) {
        if (typeof handler !== "function")
            return this;
        if (!this._listeners[event])
            this._listeners[event] = [];
        this._listeners[event].push(handler);
        return this;
    }
    once(event, handler) {
        if (typeof handler !== "function")
            return this;
        const wrapped = (payload) => {
            this.off(event, wrapped);
            handler(payload);
        };
        return this.on(event, wrapped);
    }
    off(event, handler) {
        if (!this._listeners[event])
            return this;
        if (!handler)
            delete this._listeners[event];
        else
            this._listeners[event] = this._listeners[event].filter((fn) => fn !== handler && fn.__egpOriginal !== handler);
        return this;
    }
    whenDone() {
        return this._done;
    }
    getResult() {
        return this._result;
    }
    getReceipt() {
        return this._receipt;
    }
    _emit(event, payload) {
        const optionHandler = {
            success: this.onSuccess,
            error: this.onError,
            cancel: this.onCancel,
            pending: this.onPending,
            attempt: this.onAttempt,
            notice: this.onNotice,
            close: this.onClose,
            step: this.onStepChange,
        }[event];
        const handlers = [];
        if (typeof optionHandler === "function")
            handlers.push(optionHandler);
        (this._listeners[event] || []).forEach((fn) => handlers.push(fn));
        (this._listeners["*"] || []).forEach((fn) => handlers.push((data) => fn(event, data)));
        handlers.forEach((fn) => {
            try {
                fn(payload);
            }
            catch (err) {
            }
        });
    }

    /* ---- Result callbacks ---- */
    _finalize(status, details = {}) {
        if (this._settled)
            return this._result;
        this._settled = true;
        this._pendingOutcome = null;
        const receipt = this.buildReceipt(status, details);
        this._receipt = receipt;
        const payload = {
            status,
            message: details.message || receipt.message || "",
            reference: receipt.merchantReference,
            transactionReference: receipt.gatewayReference,
            paymentReference: receipt.paymentReference,
            amount: receipt.amount,
            fee: receipt.fee,
            total: receipt.total,
            currency: receipt.currency,
            channel: receipt.channel,
            description: receipt.description,
            paidAt: receipt.paidAt,
            customer: receipt.customer,
            metadata: receipt.metadata,
            step: this.currentStep,
            receipt,
        };
        this._result = payload;
        this._emit({
            success: "success",
            cancelled: "cancel",
            pending: "pending",
        }[status] || "error", payload);
        if (this._resolveDone)
            this._resolveDone(payload);
        return payload;
    }
    _notifyAttempt(status, details = {}) {
        const receipt = this.buildReceipt(status, details);
        this._receipt = receipt;
        this._emit("attempt", {
            status,
            message: details.message || "",
            reference: receipt.merchantReference,
            transactionReference: receipt.gatewayReference,
            paymentReference: receipt.paymentReference,
            retryable: true,
            step: this.currentStep,
            receipt,
        });
        return receipt;
    }

    /* ---- Close / cancel ---- */
    handleCancel() {
        ["payment-popup", "otp-popup", "error-modal", "payment-overlay"].forEach((id) => this.removePopup(id));
        this._finalize("cancelled", { message: "Payment cancelled by the user." });
        this.handleClose("USER_CANCELLED");
    }
    handleClose(reason = "USER_CLOSED") {
        if (this._closed)
            return;
        this._closed = true;
        if (!this._settled) {
            this._finalize(this._pendingOutcome || "cancelled", {
                message: this._pendingMessage || "Payment window was closed before completion.",
            });
        }
        this.removeAllPopups();
        this._removeResultModal();
        this._releaseReceiptResources();
        document.removeEventListener("keydown", this.handleEscKey);
        this._emit("close", {
            reason,
            step: this.currentStep,
            result: this._result || null,
        });
    }
    handleEscKey(e) {
        if (e.key !== "Escape")
            return;
        if (document.getElementById("error-modal")) {
            this.removePopup("error-modal");
            return;
        }
        this.handleClose("KEYBOARD_ESC");
    }

    /* ---- UI: shell + tabs ---- */
    _shell(main) {
        const esc = (v) => this._esc(v);
        return `
      <div class="egp-shell">
        <div class="egp-sidebar">
          <img src="${esc(this.companyLogo)}" alt="EgolePay">
          <div class="egp-amount-box">
            <div class="lbl">Amount to pay</div>
            <div class="val">${esc(this._formatMoney(this.totalAmount))}</div>
            <div class="sub">Fees included</div>
          </div>
          <p class="egp-sb-tagline">Fast &amp; secure payments</p>
          <div class="egp-sb-secure">Secured by EgolePay</div>
        </div>
        <div class="egp-main">${main}</div>
      </div>`;
    }
    _tabs(active) {
        const channels = [
            { id: "card", label: "Pay with Card", primary: true },
            { id: "transfer", label: "Pay with Bank Transfer" },
        ].filter(Boolean);
        const esc = (v) => this._esc(v);
        const label = { card: "Card Payment", transfer: "Bank Transfer" };
        return `<div class="egp-tabs">${channels
            .map((c) => `<button id="egp-tab-${esc(c.id)}" class="egp-tab${c.id === active ? " focused" : ""}">${esc(label[c.id] || c.label)}</button>`)
            .join("")}</div>`;
    }
    _bindTabs(active) {
        const channels = [
            { id: "card", primary: true },
            { id: "transfer" },
        ].filter(Boolean);
        channels.forEach((channel) => {
            if (channel.id === active)
                return;
            const node = document.getElementById(`egp-tab-${channel.id}`);
            if (!node)
                return;
            node.addEventListener("click", () => {
                this.removePopup("payment-popup");
                if (typeof channel.start === "function")
                    return channel.start(this);
                if (channel.id === "card")
                    return this.showCardPaymentForm();
                if (channel.id === "transfer")
                    return this.initiateTransfer();
                this.showErrorModal(`No handler for the "${channel.id}" channel.`);
            });
        });
    }

    /* ---- UI: payment options ---- */
    showPaymentOptionsPopup() {
        (this.updateStep("payment_options"), this.removePopup("payment-popup"));
        const channels = [
            { id: "card", label: "Pay with Card", primary: true },
            { id: "transfer", label: "Pay with Bank Transfer" },
        ].filter(Boolean);
        if (!channels.length)
            return this.showResultModal({
                status: "failed",
                title: "No payment method available",
                message: `The checkout offers no payment channel.`,
            });
        const esc = (v) => this._esc(v);
        this._injectStyles();
        const buttons = channels
            .map((channel, i) => `<button id="egp-channel-${esc(channel.id)}" class="egp-btn ${channel.primary || i === 0 ? "egp-btn-primary" : "egp-btn-secondary"}">${esc(channel.label)}</button>`)
            .join("");
        document.body.appendChild(this.createOverlay());
        const popup = document.createElement("div");
        popup.id = "payment-popup";
        popup.innerHTML = this._shell(`
          <button class="egp-close" id="cancel-payment" aria-label="Close" title="Close">&times;</button>
          <div class="egp-main-header">
            <h2>Complete your payment</h2>
            <p>Choose a payment method below</p>
          </div>
          <div class="egp-panels">
            ${buttons}
            <div class="egp-secure-note">Your payment is secured with encryption</div>
          </div>`);
        document.body.appendChild(popup);
        channels.forEach((channel) => {
            const node = document.getElementById(`egp-channel-${channel.id}`);
            if (!node)
                return;
            node.addEventListener("click", () => {
                this.removePopup("payment-popup");
                if (typeof channel.start === "function")
                    return channel.start(this);
                if (channel.id === "card")
                    return this.showCardPaymentForm();
                if (channel.id === "transfer")
                    return this.initiateTransfer();
                this.showErrorModal(`No handler for the "${channel.id}" channel.`);
            });
        });
        document.getElementById("cancel-payment").addEventListener("click", () => {
            (this.removePopup("payment-popup"),
                this.removePopup("payment-overlay"),
                this.handleCancel());
        });
    }

    /* ---- UI: card form ---- */
    showCardPaymentForm() {
        (this.updateStep("card_payment"), this.removePopup("payment-popup"));
        const esc = (v) => this._esc(v);
        this._injectStyles();
        const extras = this._extraFieldsFor("card");
        document.body.appendChild(this.createOverlay());
        const popup = document.createElement("div");
        popup.id = "payment-popup";
        popup.innerHTML = this._shell(`
          <button class="egp-close egp-back" id="back-to-options" aria-label="Back to payment methods" title="Back">&#8592;</button>
          <div class="egp-main-header">
            <h2>Complete your payment</h2>
            <p>Choose a payment method below</p>
          </div>
          ${this._tabs("card")}
          <div class="egp-panels">
            <h3 class="egp-title">Card Payment</h3>
            <p class="egp-subtitle">Secure payment processed with encryption</p>

            <div class="egp-card-icons">
              ${EgolePayAssets.cardSchemes
            .map((scheme) => `<img src="${esc(scheme.src)}" alt="${esc(scheme.alt)}">`)
            .join("\n              ")}
            </div>

            ${this._extraFieldsMarkup(extras)}

            <label class="egp-label" for="amountToPay">Amount Due to Pay</label>
            <input id="amountToPay" class="egp-input readonly" value="${esc(this._formatMoney(this.totalAmount))}" readonly tabindex="-1">

            <label class="egp-label" for="card-number">Credit Card Number</label>
            <input type="text" id="card-number" class="egp-input" placeholder="1234 5678 9012 3456" maxlength="24"
                   inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false"
                   required aria-label="Card number">

            <div class="egp-row">
              <div>
                <label class="egp-label" for="card-expiry">Expiry</label>
                <input type="text" id="card-expiry" class="egp-input" placeholder="MM/YY" maxlength="5"
                       inputmode="numeric" autocomplete="off" spellcheck="false"
                       required aria-label="Card expiry date">
              </div>
              <div>
                <label class="egp-label" for="card-cvv">CVV</label>
                <input type="password" id="card-cvv" class="egp-input" placeholder="123" maxlength="4"
                       inputmode="numeric" autocomplete="one-time-code" spellcheck="false"
                       required aria-label="Card security code">
              </div>
            </div>

            <label class="egp-label" for="card-pin">Card PIN</label>
            <input type="password" id="card-pin" class="egp-input pin-mask" placeholder="••••" maxlength="4"
                   inputmode="numeric" autocomplete="one-time-code" spellcheck="false"
                   required aria-label="Card PIN">

            <button class="egp-btn egp-btn-primary" type="button" id="process-card-payment">Pay Securely</button>

            <div class="egp-secure-note">Your payment is secured with encryption</div>
          </div>`);
        document.body.appendChild(popup);
        this._bindTabs("card");
        document.getElementById("card-number").addEventListener("input", (e) => {
            let t = e.target.value.replace(/\D/g, "").substring(0, 20);
            ((t = t.replace(/(\d{4})/g, "$1 ").trim()), (e.target.value = t));
        });
        document.getElementById("card-expiry").addEventListener("input", (e) => {
            let t = e.target.value.replace(/\D/g, "");
            (t.length >= 2 && (t = t.substring(0, 2) + "/" + t.substring(2, 4)),
                (e.target.value = t));
        });
        document.getElementById("card-cvv").addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/\D/g, "").substring(0, 4);
        });
        document.getElementById("card-pin").addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/\D/g, "").substring(0, 4);
        });
        document.getElementById("process-card-payment").addEventListener("click", () => {
            if (extras.length && !this._readExtraFields(extras))
                return;
            const e = document.getElementById("card-number").value.replace(/\s/g, ""), t = document.getElementById("card-expiry").value, n = document.getElementById("card-cvv").value, o = document.getElementById("card-pin").value;
            const invalid = this.validateCardInformation(e, t, n, o);
            if (invalid)
                return void this.showErrorModal(invalid);
            const [i, a] = t.split("/");
            const card = {
                number: e,
                expiryMonth: i,
                expiryYear: a,
                cvv: n,
                pin: o,
            };
            ["card-number", "card-expiry", "card-cvv", "card-pin"].forEach((id) => this._scrubField(id));
            (this.removePopup("payment-popup"),
                this.removePopup("payment-overlay"),
                this.processCardPayment(card));
        });
        document.getElementById("back-to-options").addEventListener("click", () => {
            (this.removePopup("payment-popup"),
                this.removePopup("payment-overlay"),
                this.showPaymentOptionsPopup());
        });
    }

    /* ---- UI: OTP ---- */
    showOtpPopup(paymentReference, threeDS = null) {
        this.updateStep("otp_verification");
        this.removePopup("payment-popup");
        this.removePopup("otp-popup");
        this._injectStyles();
        document.body.appendChild(this.createOverlay());
        const requiresAuth = threeDS && threeDS.requiresAuth;
        const popup = document.createElement("div");
        popup.id = "otp-popup";
        popup.setAttribute("role", "dialog");
        popup.setAttribute("aria-modal", "true");
        popup.className = "egp-center-modal";
        popup.style.cssText =
            "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:90%;" +
                "max-width:380px;padding:28px 26px;z-index:1003;";
        const boxes = Array.from({ length: 6 }, (_, i) => `<input type="text" class="egp-otp-box" id="otp-box-${i}" inputmode="numeric" ` +
            `pattern="[0-9]*" maxlength="1" required placeholder=" " aria-label="Digit ${i + 1} of 6"` +
            `${i === 0 ? ' autocomplete="one-time-code"' : ""}>`).join("");
        popup.innerHTML = `
        <h3 class="egp-title" style="text-align:center;">${requiresAuth ? "3DS Authentication" : "OTP Verification"}</h3>
        <p class="egp-subtitle" style="text-align:center;">
            ${requiresAuth ? "Complete authentication with your bank" : "Enter the 6-digit code sent to your phone"}
        </p>

        ${requiresAuth
            ? `<div class="egp-info-box" style="text-align:center;">
             <p style="margin:0;font-size:13px;color:#64748b;">You will be redirected to your bank&rsquo;s 3DS page for authentication.</p>
           </div>`
            : `<div class="egp-otp-row" id="otp-row">${boxes}</div>
        <p class="egp-otp-hint" id="otp-hint" role="status" aria-live="polite">All 6 digits are required</p>`}

        <button id="submit-otp" class="egp-btn egp-btn-primary"${requiresAuth ? "" : " disabled"}>${requiresAuth ? "Continue to Bank" : "Verify OTP"}</button>
        <button id="cancel-otp" class="egp-btn egp-btn-secondary">Cancel</button>`;
        document.body.appendChild(popup);
        const submit = document.getElementById("submit-otp");
        if (requiresAuth) {
            submit.addEventListener("click", () => {
                if (threeDS && threeDS.acsUrl)
                    window.location.href = threeDS.acsUrl;
                else
                    this.confirmOtp(null, paymentReference, threeDS);
            });
        }
        else {
            const inputs = Array.from({ length: 6 }, (_, i) => document.getElementById(`otp-box-${i}`));
            const hint = document.getElementById("otp-hint");
            const code = () => inputs.map((box) => box.value).join("");
            const sync = () => {
                const complete = /^\d{6}$/.test(code());
                submit.disabled = !complete;
                submit.style.opacity = complete ? "1" : ".5";
                submit.style.cursor = complete ? "pointer" : "not-allowed";
                if (complete && hint)
                    hint.textContent = "";
                return complete;
            };
            const fill = (digits, from = 0) => {
                digits.split("").forEach((digit, offset) => {
                    const box = inputs[from + offset];
                    if (box)
                        box.value = digit;
                });
                const next = Math.min(from + digits.length, 5);
                inputs[next].focus();
                inputs[next].select();
                sync();
            };
            inputs.forEach((box, index) => {
                box.addEventListener("input", () => {
                    const digits = box.value.replace(/\D/g, "");
                    if (digits.length > 1)
                        return fill(digits.slice(0, 6 - index), index);
                    box.value = digits;
                    if (digits && index < 5)
                        inputs[index + 1].focus();
                    sync();
                });
                box.addEventListener("keydown", (event) => {
                    if (event.key === "Backspace" && !box.value && index > 0) {
                        event.preventDefault();
                        inputs[index - 1].value = "";
                        inputs[index - 1].focus();
                        sync();
                    }
                    else if (event.key === "ArrowLeft" && index > 0) {
                        inputs[index - 1].focus();
                    }
                    else if (event.key === "ArrowRight" && index < 5) {
                        inputs[index + 1].focus();
                    }
                    else if (event.key === "Enter") {
                        submit.click();
                    }
                });
                box.addEventListener("paste", (event) => {
                    event.preventDefault();
                    const pasted = (event.clipboardData || window.clipboardData)
                        .getData("text")
                        .replace(/\D/g, "");
                    if (pasted)
                        fill(pasted.slice(0, 6 - index), index);
                });
                box.addEventListener("focus", () => box.select());
            });
            sync();
            inputs[0].focus();
            submit.addEventListener("click", () => {
                if (!sync()) {
                    if (hint) {
                        hint.textContent = "Enter all 6 digits of the code";
                        hint.style.color = "#D93025";
                    }
                    const firstEmpty = inputs.find((box) => !box.value) || inputs[0];
                    firstEmpty.focus();
                    return;
                }
                this.confirmOtp(code(), paymentReference, threeDS);
            });
        }
        document.getElementById("cancel-otp").addEventListener("click", () => {
            this.removePopup("otp-popup");
            this.removePopup("payment-overlay");
            this.handleCancel();
        });
    }

    /* ---- Receipt ---- */
    buildReceipt(status, details = {}) {
        let paidAt = details.paidAt ? new Date(details.paidAt) : new Date();
        if (isNaN(paidAt.getTime()))
            paidAt = new Date();
        const amount = this.convertToNumber(this.amount) || 0;
        const fee = this.convertToNumber(this.serviceFee) || 0;
        const total = this.convertToNumber(this.totalAmount) || amount + fee;
        const receipt = {
            merchantReference: this.reference || "",
            gatewayReference: this.transactionReference || "",
            paymentReference: details.paymentReference || this.paymentReference || "",
            status,
            statusLabel: this._statusLabel(status),
            message: details.message || "",
            amount,
            fee,
            total,
            currency: this.currency || "NGN",
            description: details.description || this.description || "Payment",
            channel: details.channel || this.paymentChannel || "N/A",
            paidAt: paidAt.toISOString(),
            paidAtLabel: this._formatReceiptDate(paidAt),
            customer: {
                name: this.customerName || "",
                email: this.email || "",
                phone: this.phone || "",
            },
            merchantName: this.merchantName || "",
            card: details.card || this.cardSummary || null,
            bank: details.bank || this.transferSummary || null,
            metadata: this.metadata || {},
            mode: this.isTestMode ? "TEST" : "LIVE",
            issuer: "EgolePay",
            externalReceipts: this._parseExternalReceipts(details.receiptUrls || this.receiptUrls || [], details.receiptNames || []),
        };
        receipt.verificationCode = this._sealReceipt(receipt);
        return receipt;
    }
    /* ---- Styles ---- */
    _injectStyles() {
        if (document.getElementById("egp-standard-styles"))
            return;
        const style = document.createElement("style");
        style.id = "egp-standard-styles";
        style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

/* ---- shell (sidebar + main) ---- */
#payment-popup{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;z-index:1001;font-family:'DM Sans',sans-serif;box-sizing:border-box;}
#payment-popup *{box-sizing:border-box;}
.egp-shell{background:#fff;border-radius:16px;overflow:hidden;width:100%;max-width:760px;display:flex;box-shadow:0 24px 60px rgba(0,0,0,.18);max-height:96vh;position:relative;}
.egp-sidebar{width:240px;flex-shrink:0;background:#0f172a;color:#fff;padding:28px 20px;display:flex;flex-direction:column;box-sizing:border-box;}
.egp-sidebar img{height:38px;margin-bottom:16px;object-fit:contain;align-self:flex-start;max-width:100%;}
.egp-sb-tagline{font-size:13px;color:#94a3b8;margin:0 0 20px;}
.egp-amount-box{background:rgba(255,255,255,.07);border-radius:10px;padding:14px 16px;margin-bottom:20px;}
.egp-amount-box .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#64748b;margin-bottom:4px;}
.egp-amount-box .val{font-size:22px;font-weight:700;color:#ff8c00;}
.egp-amount-box .sub{font-size:12px;color:#64748b;margin-top:4px;}
.egp-sb-secure{margin-top:auto;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:#64748b;}
.egp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;min-width:0;}
.egp-main-header{padding:22px 26px 0;}
.egp-main-header h2{margin:0 0 4px;font-size:18px;color:#0f172a;font-weight:700;}
.egp-main-header p{margin:0 0 14px;font-size:13px;color:#64748b;}
.egp-tabs{display:flex;gap:6px;padding:0 26px 14px;border-bottom:1px solid #f1f5f9;}
.egp-tab{flex:1;width:auto;margin:0;padding:10px 6px;border-radius:8px;border:none;background:#f1f5f9;font-size:13px;font-weight:600;color:#64748b;cursor:pointer;transition:background .15s,color .15s;font-family:'DM Sans',sans-serif;}
.egp-tab:hover:not(.focused){background:#e2e8f0;}
.egp-tab.focused{background:#ff8c00;color:#fff;}
.egp-panels{flex:1;overflow-y:auto;padding:20px 26px 24px;}

/* ---- forms ---- */
.egp-title{font-size:18px;font-weight:700;color:#0f172a;margin:0 0 4px;}
.egp-subtitle{font-size:13px;color:#64748b;margin:0 0 16px;}
.egp-label{display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:5px;}
.egp-input{width:100%;padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;transition:border .15s,box-shadow .15s;box-sizing:border-box;margin-bottom:13px;color:#0f172a;background:#fff;}
.egp-input::placeholder{color:#b6c2d2;}
.egp-input:focus{border-color:#ff8c00;box-shadow:0 0 0 3px rgba(255,140,0,.1);}
.egp-input.readonly{font-weight:700;color:#ff8c00;background:#fff7ed;border-color:#fed7aa;}
.egp-row{display:flex;gap:10px;}
.egp-row>div{flex:1;min-width:0;}
.egp-btn{display:block;width:100%;margin:0;padding:10px 16px;border:1px solid transparent;border-radius:3px;font-size:14px;line-height:1.42857;font-weight:600;text-align:center;white-space:nowrap;vertical-align:middle;cursor:pointer;font-family:'DM Sans',sans-serif;-webkit-user-select:none;user-select:none;box-sizing:border-box;-webkit-transition:background-color .15s ease-in-out,border-color .15s ease-in-out;transition:background-color .15s ease-in-out,border-color .15s ease-in-out;}
.egp-btn:focus{outline:thin dotted;outline:5px auto -webkit-focus-ring-color;outline-offset:-2px;}
.egp-btn:active{-webkit-box-shadow:inset 0 3px 5px rgba(0,0,0,.125);box-shadow:inset 0 3px 5px rgba(0,0,0,.125);}
.egp-btn-primary{background-color:#ff8c00;border-color:#e07d00;color:#fff;}
.egp-btn-primary:hover{background-color:#e67e00;border-color:#c46c00;}
.egp-btn-primary:disabled{opacity:.65;cursor:not-allowed;box-shadow:none;background-color:#ff8c00;border-color:#e07d00;}
.egp-btn-secondary{background-color:#fff;border-color:#ccc;color:#333;margin-top:8px;}
.egp-btn-secondary:hover{background-color:#e6e6e6;border-color:#adadad;}
.egp-btn-green{background-color:#5cb85c;border-color:#4cae4c;color:#fff;}
.egp-btn-green:hover{background-color:#449d44;border-color:#398439;}
.egp-card-icons{display:flex;gap:8px;margin-bottom:16px;}
.egp-card-icons img{height:26px;opacity:.85;}
.egp-secure-note{font-size:11px;color:#94a3b8;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;}

/* ---- bank / transfer boxes ---- */
.egp-bank-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:6px 16px;margin-bottom:14px;}
.egp-bank-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f1f5f9;gap:12px;}
.egp-bank-row:last-child{border-bottom:none;}
.egp-bank-row .lbl{font-size:12px;color:#94a3b8;flex-shrink:0;}
.egp-bank-row .val{font-weight:600;color:#0f172a;font-size:14px;text-align:right;word-break:break-word;}
.egp-bank-row .val.accent{color:#ff8c00;font-size:16px;}
.egp-copy-btn{background-color:#fff;border:1px solid #ccc;color:#333;border-radius:3px;padding:3px 10px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin-left:8px;-webkit-transition:background-color .15s ease-in-out,border-color .15s ease-in-out;transition:background-color .15s ease-in-out,border-color .15s ease-in-out;}
.egp-copy-btn:hover{background-color:#e6e6e6;border-color:#adadad;}
.egp-copy-btn.copied{background-color:#5cb85c;border-color:#4cae4c;color:#fff;}
.egp-warn{background:#fff7ed;border:1.5px solid #fed7aa;border-radius:8px;padding:10px 13px;font-size:12px;color:#9a3412;margin-bottom:14px;display:flex;gap:8px;align-items:center;}

/* ---- centered modal (otp / result / a module's own intake screen) ----
   A centered modal may reuse the #payment-popup id, so it has to opt out of
   the shell's full-screen flex centering and position itself instead. */
#payment-popup.egp-center-modal{inset:auto;right:auto;bottom:auto;display:block;padding:0;}
.egp-center-modal{font-family:'DM Sans',sans-serif;background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.18);color:#0f172a;box-sizing:border-box;}
.egp-center-modal *{box-sizing:border-box;}
.egp-modal-logo{text-align:center;margin-bottom:18px;}
.egp-modal-logo img{height:34px;object-fit:contain;max-width:180px;}
.egp-info-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:10px;}
.egp-info-box .lbl,.egp-info-box label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin:0 0 4px;display:block;font-weight:600;}
.egp-info-box .value-display{font-size:15px;font-weight:600;color:#0f172a;display:block;word-break:break-word;}
.egp-checkbox-label{display:flex;align-items:center;gap:10px;font-size:14px;color:#0f172a;font-weight:500;padding:4px 0;}
.egp-checkbox-label input{accent-color:#ff8c00;width:16px;height:16px;}

/* ---- a module's intake screen: centred, capped, scrolling inside itself ---- */
#payment-popup.egp-bill-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:90%;max-width:460px;padding:24px;z-index:1001;max-height:92vh;overflow-x:hidden;background:#fff;}
.egp-bill-body{max-height:60vh;overflow-y:auto;margin:0 0 4px;padding-right:4px;}
.egp-bill-body #service-fee-info{font-size:11px;font-weight:500;color:#94a3b8;text-transform:none;letter-spacing:0;margin-top:4px;}
@media(max-width:576px){
  #payment-popup.egp-bill-modal{top:0;left:0;transform:none;width:100vw;height:100vh;max-width:100%;max-height:100%;border-radius:0;padding:16px;overflow-y:auto;}
  .egp-bill-body{max-height:none;}
}

/* ---- close / back button: round, pinned to the panel edge ----
 * .egp-close dismisses (x). .egp-back returns to the previous screen and
 * carries an arrow, because those are not the same promise to the payer.
 */
.egp-close{position:absolute;top:10px;right:14px;width:auto;height:auto;margin:0;padding:0 4px;display:block;background:none;border:0;border-radius:0;font-size:24px;font-weight:700;line-height:1;color:#000;opacity:.4;cursor:pointer;font-family:Arial,Helvetica,sans-serif;z-index:3;-webkit-transition:opacity .15s ease-in-out;transition:opacity .15s ease-in-out;}
.egp-close:hover,.egp-close:focus{opacity:.75;outline:none;}


.egp-close.egp-back{right:auto;left:12px;font-size:17px;}
/* the back arrow sits where the title starts, so give the title room for it */
.egp-close.egp-back+.egp-main-header{padding-left:58px;}
@media(prefers-reduced-motion:reduce){.egp-close{transition:none;}}

/* ---- OTP: six boxes, this core's own markup, verxid's tokens ---- */
.egp-otp-row{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:8px;}
.egp-otp-box{width:100%;height:52px;text-align:center;font-size:21px;font-weight:700;color:#0f172a;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;font-family:'DM Sans',sans-serif;padding:0;-moz-appearance:textfield;outline:none;transition:border .15s,box-shadow .15s;}
.egp-otp-box:focus{border-color:#ff8c00;box-shadow:0 0 0 3px rgba(255,140,0,.1);}
.egp-otp-box:not(:placeholder-shown){border-color:#ff8c00;}
.egp-otp-hint{margin:0 0 18px;font-size:12px;color:#94a3b8;text-align:center;min-height:16px;}

/* ---- blocking spinner ---- */
#processing-overlay .egp-load{background:#fff;border-radius:16px;padding:28px 32px;text-align:center;max-width:300px;font-family:'DM Sans',sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.18);}
#processing-overlay .egp-load-msg{font-size:14px;font-weight:600;color:#0f172a;margin-bottom:16px;}
#processing-overlay .egp-spin{width:38px;height:38px;border:4px solid #f1f5f9;border-top-color:#ff8c00;border-radius:50%;animation:egpSpin .8s linear infinite;margin:0 auto;}
@keyframes egpSpin{to{transform:rotate(360deg)}}

/* ---- responsive ---- */
@media(max-width:640px){
  .egp-shell{flex-direction:column;max-height:100vh;height:100%;border-radius:0;}
  .egp-sidebar{width:100%;flex-direction:row;align-items:center;padding:16px 20px;}
  .egp-sidebar img{margin-bottom:0;max-width:38%;height:auto;}
  .egp-sb-secure,.egp-sb-tagline{display:none;}
  .egp-amount-box{margin-bottom:0;margin-left:auto;padding:10px 14px;max-width:58%;}
  .egp-amount-box .val{font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  #payment-popup{padding:0;}
  .egp-row{flex-direction:column;gap:0;}
}
@media(max-width:380px){.egp-otp-box{height:46px;font-size:19px;}.egp-otp-row{gap:6px;}}`;
        document.head.appendChild(style);
    }

    /* ---- UI: result modal ----
     * Markup, receipt pane and buttons come from the shared EgolePayReceipt
     * block; this only decides the lifecycle (finalize vs retryable attempt). */
    showResultModal(options = {}) {
        const status = options.status || "success";
        const retryable = typeof options.retry === "function" && status !== "success";
        this.updateStep(status === "success" ? "success" : `result_${status}`);
        ["payment-popup", "otp-popup", "error-modal", "processing-overlay", "success-popup"].forEach((id) => this.removePopup(id));
        this._injectStyles();
        let receipt;
        if (retryable) {
            this._pendingOutcome = status;
            this._pendingMessage = options.message || "";
            receipt = this._notifyAttempt(status, options);
        }
        else {
            receipt = this._finalize(status, options).receipt;
        }
        if (!document.getElementById("payment-overlay"))
            document.body.appendChild(this.createOverlay());
        const hasTransaction = Boolean(this.transactionReference || this.paymentReference);
        const doneReason = {
            success: "PAYMENT_SUCCESSFUL",
            failed: "PAYMENT_FAILED",
            pending: "PAYMENT_PENDING",
            cancelled: "PAYMENT_CANCELLED",
        }[status] || "USER_CLOSED";
        this._mountResultModal({
            status,
            title: options.title,
            message: options.message,
            receipt: hasTransaction ? receipt : null,
            retry: retryable
                ? () => {
                    this.removePopup("egp-result-modal");
                    this._pendingOutcome = null;
                    this._pendingMessage = "";
                    try {
                        options.retry();
                    }
                    catch (err) {
                        this.showResultModal({ status: "failed", message: err.message || "Could not restart the payment." });
                    }
                }
                : null,
            onDone: () => {
                if (!this._settled)
                    this._finalize(status, options);
                this.handleClose(doneReason);
            },
        });
        return receipt;
    }

    /* ---- UI: simple modals ---- */
    showErrorModal(message) {
        this.removePopup("error-modal");
        this._injectStyles();
        const modal = document.createElement("div");
        modal.id = "error-modal";
        modal.setAttribute("role", "alertdialog");
        modal.style.cssText =
            "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:90%;max-width:350px;" +
                "background:#fff;border-radius: 4px;box-shadow:0 6px 20px rgba(0,0,0,.15);z-index:1004;" +
                "padding:24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
        modal.innerHTML = `
      <div style="width:50px;height:50px;background:#F44336;border-radius:50%;margin:0 auto 15px;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:25px;font-weight:700;">!</span>
      </div>
      <h3 style="color:#0F172A;margin:0 0 10px;font-size:17px;">Something needs your attention</h3>
      <p style="color:#64748B;margin:0 0 20px;font-size:14px;">${this._esc(message)}</p>
      <button type="button" id="close-error" style="background:orange;color:#fff;padding:12px;border:none;border-radius: 4px;cursor:pointer;font-size:14px;width:100%;font-weight:600;">Close</button>`;
        document.body.appendChild(modal);
        this._emit("notice", { message, step: this.currentStep });
        document.getElementById("close-error").addEventListener("click", () => {
            this.removePopup("error-modal");
        });
    }
    showNotifyErrorModal(message) {
        this.showErrorModal(message);
    }
    showSuccessModal(message, paymentReference) {
        return this.showResultModal({
            status: "success",
            title: message,
            paymentReference: Array.isArray(paymentReference)
                ? paymentReference[0]
                : paymentReference,
        });
    }
    showFailureModal(message, retry) {
        return this.showResultModal({ status: "failed", message, retry });
    }
    showPendingModal(message, retry) {
        return this.showResultModal({ status: "pending", message, retry });
    }

    /* ---- Teardown ---- */
    destroy() {
        this.handleClose("DESTROYED");
        this._listeners = {};
        this.onSuccess = null;
        this.onCancel = null;
        this.onError = null;
        this.onPending = null;
        this.onAttempt = null;
        this.onNotice = null;
        this.onClose = null;
        this.onStepChange = null;
    }
}
Object.assign(EgolePay.prototype, EgolePayReceipt);

/* ==== Exports ==== */
EgolePay.baseUrl = BASE_URL;
EgolePay.assets = EgolePayAssets;
if (typeof window !== "undefined") {
    window.EgolePay = EgolePay;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = EgolePay;
    module.exports.PayloadEncryption = PayloadEncryption;
    module.exports.EgolePayAssets = EgolePayAssets;
}

