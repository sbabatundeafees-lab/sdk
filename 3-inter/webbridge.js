class PayloadEncryption {
    constructor(e = null) { this.rsaPublicKey = e || "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt0KgRHBhfBbGM3hjrzSG\nueU9qgmkz9K5rTRGSSOznfOCJxTv4Wb46+/Hvvolh/fqgDMFzu9ygcbqw1BanLIR\nUySFbChqw7KudC8LF+D/QaHCoOsy3ce4HZXsdCmqWwH3j0eyP+WAZnezYW6ZYMzp\nRHeQoFMqNoEVZzc8Qnhd1T74oTpqmodr0pElw7s9yw1ckSfLDSVI9QRdIneaBYiI\nuCVbFtmIgM26BsRVwYTXvkMZEbJpTMeWheRr3WLlS9tHFMAPAM3HQ+TDFgOaKyqF\nOTjsJBv4Xeqbmrva+wTOOnLhYOPbVHlfhD+Jqu3phkCIIki8nFE9ZPUlYf/qP6Bn\n9QIDAQAB\n-----END PUBLIC KEY-----" }
    generateRandomBytes(e) {
        const t = new Uint8Array(e);
        return crypto.getRandomValues(t), t
    }
    arrayBufferToBase64(e) {
        const t = new Uint8Array(e);
        let n = ""; for (let e = 0; e < t.byteLength; e++)n += String.fromCharCode(t[e]);
        return btoa(n)
    }
    base64ToArrayBuffer(e) {
        const t = atob(e), n = new Uint8Array(t.length); for (let e = 0; e < t.length; e++)n[e] = t.charCodeAt(e);
        return n.buffer
    }
    async importRSAKey(e) {
        const t = e.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, "");
        return await crypto.subtle.importKey("spki", this.base64ToArrayBuffer(t), { name: "RSA-OAEP", hash: "SHA-256" }, !1, ["encrypt"])
    }
    async encryptWithAES(e, t, n) {
        const a = await crypto.subtle.importKey("raw", t, { name: "AES-CBC" }, !1, ["encrypt"]);
        return this.arrayBufferToBase64(await crypto.subtle.encrypt({ name: "AES-CBC", iv: n }, a, (new TextEncoder).encode(e)))
    }
    async encryptAESKeyWithRSA(e, t) {
        return this.arrayBufferToBase64(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, t, e))
    }
    async encrypt(e) {
        const t = this.generateRandomBytes(32), n = this.generateRandomBytes(16), a = await this.importRSAKey(this.rsaPublicKey), s = "string" == typeof e ? e : JSON.stringify(e), i = await this.encryptWithAES(s, t, n), r = await this.encryptAESKeyWithRSA(t, a);
        return { encryptedData: btoa(JSON.stringify({ EncryptedAesKey: r, IV: this.arrayBufferToBase64(n), EncryptedData: i })) }
    }
}
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
    constructor(e = {}) {
        if (!e.apiKey) throw new Error("apiKey is required (sk_test_xxx or sk_live_xxx)");
        if (!e.amount) throw new Error("amount is required");
        if (!e.email) throw new Error("email is required");

            this.apiKey = e.apiKey,
            this.isTestMode = this.apiKey.startsWith("sk_test_"),
            this.baseUrl = this.isTestMode ?
                    "https://stage-gatewayservice.egolepay.com/api/InterPaymentGateway" :
                    "https://payments.egolepay.com/api/StandardPaymentGateway",
            this.authBaseUrl = this.isTestMode ? "https://stage-gatewayservice.egolepay.com/api" : "https://payments.egolepay.com/api",
                this.tnxBearer = e.tnxBearer || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJZCI6IjAwY2E5NWZmLWE3M2YtNGM2Yy1hNDUwLTI3ZDVlYjYwNGY1ZiIsInN1YiI6ImFnZW50dGVzdEBlZ29sZXBheS5jb20iLCJlbWFpbCI6ImFnZW50dGVzdEBlZ29sZXBheS5jb20iLCJqdGkiOiI1YmEyZjE3NS0yZmI2LTQxYmUtOGQ4MC00ZjEzM2E4ZDE3ZDYiLCJpYXQiOjE3ODA3Nzk2MzksIm5iZiI6MTc4MDc3OTYzOSwiZXhwIjoxNzgwNzgzMjM5fQ.n4jJOKfmZPuwOVEfH7v19CTuIZ5buVKudwR959ZzER8",
                this.mainAcctNumber = e.tnxBearer || null,
                this.userID = e.userID || "19730",
                this.amount = e.amount,
                this.email = e.email,
                this.phone = e.phone || "",
                this.reference = e.reference || this._genRef("TXN"),
                this.metadata = e.metadata || {},
                this.customerName = e.customerName || e.email.split("@")[0],
                this.companyLogo = e.logo || "https://res.cloudinary.com/dl9m2dzgk/image/upload/v1725615415/MicrosoftTeams-image_7_sjbwtk.png",
                this.tnxType = (e.tnxType || "VAS").toString(),
                this.payload = e.payload 
                //|| "eyJFbmNyeXB0ZWRBZXNLZXkiOiJQSm1lUTQ4bll4bEZzL0RmWW15WDJ4NXdHRW13N0l6SEJlOElnaE9DNldyL0hWZXBLUVcrdFF4STJnMytoYlE2VVhwK0UzSzloUTczcmpSWUQxQ253MmI5TGdqY3RDalBHM3RKVUsrSFNTQzhCZ0lkazQ3cElpclZZM0RZUEpWcGd5Ly80RC9xQkd4dHhZK1FqRk9pbmxhVTlFZ2ZGTVhvY1k0aHg3ZHBJWUlSRWc4bTh1WWpLeFpBVCs1VktLbnBuczNzZEMxK2xmK29ydlRacHV6cHRZYkQxZ3ppTWt2L3hmQUVacTFmTmx2azRDdWU2RnozVms4RmtBWHlmeFhXVFpMRUF3TnJaTHZzVHNQeWE2WlF6QjZoVDdXSEoraWNzWFhUQnQwTVllMk8wRVdrQk52TzhLb0NkRGgrRGdHVjUvbGNNVFBxTUx6ZzRBYVNVN2ZoR3c9PSIsIklWIjoiZnptd3RuM08vTTR4enR1TnNaZTcrdz09IiwiRW5jcnlwdGVkRGF0YSI6InB2SnljTUg3bnVZbU1kbEovK2w3R014MFlnb2xURVM4NGk1TzY2NWo5ZDVDcVdCK3dZN1dRZUozOTdmR1dOUDgxWU9qdC9FNW95MnlrZXBzQjdZQjlpd2FNREhZK1VLR09kWWU5U2R1NlMrVkx2V1YwdWdsdWhWdGRWMkxMMFBoQXl5NldCRzRCN3I3THpuODFBWnNmSGo5amt0UVAzZWE4ald0UTFBeGgvWUxpMUxTaG5LSXAyNFNsY3N3U0dyZzBHQlNjMXhXY3pWeUEvTWdTalhPMDRib0Myd3lWa2h6RmE1eUVUS0laRXkwbklIYjFhcXBJODF3TlZRdnlIZ3QzVTk5cU1Va25JZVVaa01sR2tMaitnSHFqOURNRVRNL1AzK2xYRlVwZHBVPSJ9",
                this.onSuccess = e.onSuccess || function () { },
                this.onCancel = e.onCancel || function () { },
                this.onError = e.onError || function () { },
                this.onClose = e.onClose || function () { },
                this.onStepChange = e.onStepChange || function () { },
                this.currentStep = "initial",
                this.transactionRef = null,
                this.totalAmount = 0,
                this.serviceFee = 0,
                this.transferDetails = null,
                this.pendingPaymentRef = null,
                this.pendingThreeDS = null,
                this.savedToken = null,
                this.guidlog = e.guidlog || 19730,
                this._walletPaid = !1,
                this.enc = new PayloadEncryption,
                this._handleEscKey = this._handleEscKey.bind(this),
                this._injectStyles(), this._init()
    }
    _genRef(e = "TXN") {
        return `${e}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    }
    _fmt(e) {
        return "₦" + Number(e).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    _updateStep(e, t = {}) {
        const n = this.currentStep; this.currentStep = e, "function" == typeof this.onStepChange && this.onStepChange({ previousStep: n, currentStep: e, data: t })
    }
    _el(e) {
        return document.getElementById(e)
    }
    _remove(...e) { e.forEach(e => { const t = this._el(e); t && t.remove() }) } _injectStyles() {
        if (this._el("egp-sdk-styles")) return;
        const e = document.createElement("style");
        e.id = "egp-sdk-styles",
            e.textContent = "\n            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');\n            #egp-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:'DM Sans',sans-serif;}\n            #egp-modal{background:#fff;border-radius:16px;overflow:hidden;width:100%;max-width:760px;display:flex;box-shadow:0 24px 60px rgba(0,0,0,.18);max-height:96vh;position:relative;}\n            #egp-sidebar{width:240px;flex-shrink:0;background:#0f172a;color:#fff;padding:28px 20px;display:flex;flex-direction:column;gap:0;}\n            #egp-sidebar img{height:36px;margin-bottom:16px;}\n            .egp-sb-tagline{font-size:13px;color:#94a3b8;margin-bottom:20px;}\n            .egp-amount-box{background:rgba(255,255,255,.07);border-radius:10px;padding:14px 16px;margin-bottom:20px;}\n            .egp-amount-box .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#64748b;margin-bottom:4px;}\n            .egp-amount-box .val{font-size:22px;font-weight:700;color:#ff8c00;}\n            .egp-amount-box .sub{font-size:12px;color:#64748b;margin-top:4px;}\n            .egp-sb-secure{margin-top:auto;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:#475569;}\n            #egp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;}\n            #egp-main-header{padding:22px 26px 0;border-bottom:1px solid #f1f5f9;}\n            #egp-main-header h2{margin:0 0 4px;font-size:18px;color:#0f172a;font-weight:700;}\n            #egp-main-header p{margin:0 0 14px;font-size:13px;color:#64748b;}\n            .egp-tabs{display:flex;gap:6px;padding:0 26px 14px;}\n            .egp-tab{flex:1;width:auto;margin:0;padding:9px 6px;border-radius:8px;border:none;background:#f1f5f9;font-size:12px;font-weight:600;color:#64748b;cursor:pointer;transition:background .15s,color .15s;font-family:'DM Sans',sans-serif;}\n            .egp-tab:hover:not(.active){background:#e2e8f0;}\n            .egp-tab.active{background:#ff8c00;color:#fff;}\n            #egp-panels{flex:1;overflow-y:auto;padding:20px 26px 24px;}\n            .egp-panel{display:none;animation:egpFade .2s ease;}\n            .egp-panel.active{display:block;}\n            @keyframes egpFade{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}\n            .egp-label{display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:5px;}\n            .egp-input{width:100%;padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;transition:border .15s,box-shadow .15s;box-sizing:border-box;margin-bottom:13px;}\n            .egp-input:focus{border-color:#ff8c00;box-shadow:0 0 0 3px rgba(255,140,0,.1);}\n            .egp-row{display:flex;gap:10px;}\n            .egp-row>div{flex:1;}\n            .egp-btn{display:block;width:100%;margin:0;padding:10px 16px;border:1px solid transparent;border-radius:3px;font-size:14px;line-height:1.42857;font-weight:600;text-align:center;white-space:nowrap;vertical-align:middle;cursor:pointer;font-family:'DM Sans',sans-serif;-webkit-user-select:none;user-select:none;box-sizing:border-box;-webkit-transition:background-color .15s ease-in-out,border-color .15s ease-in-out;transition:background-color .15s ease-in-out,border-color .15s ease-in-out;}\n            .egp-btn:focus{outline:thin dotted;outline:5px auto -webkit-focus-ring-color;outline-offset:-2px;}\n            .egp-btn:active{-webkit-box-shadow:inset 0 3px 5px rgba(0,0,0,.125);box-shadow:inset 0 3px 5px rgba(0,0,0,.125);}\n            .egp-btn-primary{background-color:#ff8c00;border-color:#e07d00;color:#fff;}\n            .egp-btn-primary:hover:not(:disabled){background-color:#e67e00;border-color:#c46c00;}\n            .egp-btn-primary:disabled{opacity:.65;cursor:not-allowed;box-shadow:none;background-color:#ff8c00;border-color:#e07d00;}\n            .egp-btn-secondary{background-color:#fff;border-color:#ccc;color:#333;margin-top:8px;}\n            .egp-btn-secondary:hover{background-color:#e6e6e6;border-color:#adadad;}\n            .egp-btn-green{background-color:#5cb85c;border-color:#4cae4c;color:#fff;}\n            .egp-btn-green:hover{background-color:#449d44;border-color:#398439;}\n            .egp-status{padding:11px 14px;border-radius:8px;font-size:13px;margin-bottom:14px;display:none;line-height:1.5;}\n            .egp-status.show{display:block;}\n            .egp-status.success{background:#dcfce7;color:#166534;border:1px solid #bbf7d0;}\n            .egp-status.error{background:#fee2e2;color:#991b1b;border:1px solid #fecaca;}\n            .egp-status.info{background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;}\n            .egp-bank-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:14px;}\n            .egp-bank-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;}\n            .egp-bank-row:last-child{border-bottom:none;}\n            .egp-bank-row .lbl{font-size:12px;color:#94a3b8;}\n            .egp-bank-row .val{font-weight:600;color:#0f172a;font-size:14px;}\n            .egp-bank-row .val.accent{color:#ff8c00;font-size:18px;}\n            .egp-copy-btn{background-color:#fff;border:1px solid #ccc;color:#333;border-radius:3px;padding:3px 10px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;-webkit-transition:background-color .15s ease-in-out,border-color .15s ease-in-out;transition:background-color .15s ease-in-out,border-color .15s ease-in-out;}\n            .egp-copy-btn:hover{background-color:#e6e6e6;border-color:#adadad;}\n            .egp-expiry-notice{background:#fff7ed;border:1.5px solid #fed7aa;border-radius:8px;padding:10px 13px;font-size:12px;color:#9a3412;margin-bottom:14px;}\n            .egp-success-box{text-align:center;padding:12px 0;}\n            .egp-success-icon{width:56px;height:56px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:26px;color:#fff;}\n            .egp-ref-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;font-size:13px;margin:12px 0 14px;text-align:left;}\n            .egp-ref-box .lbl{color:#94a3b8;font-size:11px;margin-bottom:3px;}\n            .egp-ref-box .val{font-weight:600;color:#0f172a;word-break:break-all;}\n            .egp-otp-input{text-align:center;font-size:22px;letter-spacing:8px;}\n            .egp-spinner{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:egpSpin .7s linear infinite;margin-right:6px;vertical-align:middle;}\n            @keyframes egpSpin{to{transform:rotate(360deg)}}\n            #egp-close-btn{position:absolute;top:10px;right:14px;width:auto;height:auto;margin:0;padding:0 4px;display:block;background:none;border:0;border-radius:0;font-size:24px;font-weight:700;line-height:1;color:#000;opacity:.4;cursor:pointer;font-family:Arial,Helvetica,sans-serif;z-index:3;-webkit-transition:opacity .15s ease-in-out;transition:opacity .15s ease-in-out;}\n            #egp-close-btn:hover,#egp-close-btn:focus{opacity:.75;outline:none;}\n            \n            #egp-loading{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:9999;display:flex;justify-content:center;align-items:center;}\n            .egp-loading-card{background:#fff;padding:28px 32px;border-radius:12px;text-align:center;}\n            .egp-loading-card .egp-big-spinner{width:38px;height:38px;border:4px solid #f1f5f9;border-top-color:#ff8c00;border-radius:50%;animation:egpSpin .8s linear infinite;margin:0 auto 12px;}\n            .egp-loading-card p{margin:0;font-size:14px;font-weight:600;color:#475569;font-family:'DM Sans',sans-serif;}\n                        .egp-receipt-actions{display:flex;gap:8px;padding:14px 26px 18px;}\n            .egp-receipt-actions button{flex:1;padding:10px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;}\n\n            /* PIN Modal */\n            #egp-pin-overlay{position:fixed;inset:0;background:rgba(15,23,42,.65);z-index:10000;display:flex;justify-content:center;align-items:center;padding:16px;font-family:'DM Sans',sans-serif;}\n            .egp-pin-card{background:#fff;border-radius:14px;padding:28px 24px;max-width:320px;width:100%;text-align:center;box-shadow:0 16px 40px rgba(0,0,0,.2);}\n            .egp-pin-card h3{margin:0 0 6px;font-size:17px;color:#0f172a;}\n            .egp-pin-card p{margin:0 0 18px;font-size:13px;color:#64748b;}\n            .egp-pin-dots{display:flex;justify-content:center;gap:12px;margin-bottom:18px;}\n            .egp-pin-dot{width:14px;height:14px;border-radius:50%;border:2px solid #e2e8f0;background:#fff;transition:background .15s,border-color .15s;}\n            .egp-pin-dot.filled{background:#ff8c00;border-color:#ff8c00;}\n            .egp-pin-input-hidden{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;}\n            .egp-pin-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;}\n            .egp-pin-key{padding:12px 0;border-radius:3px;border:1px solid #ccc;background-color:#fff;font-size:16px;font-weight:600;color:#333;cursor:pointer;font-family:'DM Sans',sans-serif;-webkit-transition:background-color .15s ease-in-out;transition:background-color .15s ease-in-out;}\n            .egp-pin-key:hover{background-color:#e6e6e6;border-color:#adadad;}\n            .egp-pin-key:active{background-color:#d4d4d4;-webkit-box-shadow:inset 0 3px 5px rgba(0,0,0,.125);box-shadow:inset 0 3px 5px rgba(0,0,0,.125);}\n            .egp-pin-key.del{background:#fff0f0;border-color:#fecaca;color:#ef4444;}\n            .egp-pin-key.del:hover{background:#fee2e2;}\n            @media(max-width:640px){#egp-modal{flex-direction:column;max-height:98vh;}#egp-sidebar{width:100%;flex-direction:row;align-items:center;padding:16px 20px;overflow:hidden;}#egp-sidebar>img{flex-shrink:0;max-width:40%;}.egp-sb-secure{display:none;}.egp-amount-box{margin-bottom:0;margin-left:auto;padding:10px 14px;min-width:0;max-width:58%;}.egp-amount-box .val{font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.egp-sb-tagline{display:none;margin:0;}}\n        ",
            document.head.appendChild(e)
    }
    _showLoading(e = "Please wait...") {
        this._remove("egp-loading");
        const t = document.createElement("div");
        t.id = "egp-loading", t.innerHTML = `<div class="egp-loading-card"><div class="egp-big-spinner"></div><p>${e}</p></div>`,
            document.body.appendChild(t)
    }
    _hideLoading() { this._remove("egp-loading") }
    _showStatus(e, t, n) {
        const a = this._el(e); a && (a.className = `egp-status ${t} show`, a.innerHTML = n)
    }
    _hideStatus(e) { const t = this._el(e); t && (t.className = "egp-status") }
    _handleEscKey(e) { "Escape" === e.key && this.close("KEYBOARD_ESC") } close(e = "USER_CLOSED") {
        this._remove("egp-backdrop", "egp-result-overlay", "egp-loading", "egp-pin-overlay"), this._removeResultModal(), this._releaseReceiptResources(),
        document.removeEventListener("keydown", this._handleEscKey), "function" == typeof this.onClose && this.onClose({ reason: e, step: this.currentStep })
    }
    _cancel() {
        "function" == typeof this.onCancel && this.onCancel({ status: "cancelled", step: this.currentStep }),
        this.close("CANCEL_BTN")
    }
    async _post(e, t, n = {}) {
        const a = await fetch(`${this.baseUrl}${e}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`, ...n
                }, body: JSON.stringify(t)
            }), s = await a.text(), i = s ? JSON.parse(s) : {}; if (!a.ok) throw new Error(i.Message || i.message || "Request failed"); return i
    }
    async _fetchExternal(e, t, n = {}) {
        const a = await fetch(e, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.tnxBearer}`, ...n
            }, body: JSON.stringify(t)
        }), s = await a.text(), i = s ? JSON.parse(s) : {}; if (!a.ok) throw new Error(i.Message || i.message || "Request failed"); return i
    }
    async _init() {
        document.addEventListener("keydown", this._handleEscKey),
            this._showLoading("Initialising payment...");
        try {
            const e = await this._post("/transactions",
                {
                    amount: this.amount,
                    reference: this.reference,
                    tnxType: this.tnxType,
                    customer: {
                        email: this.email, name: this.customerName,
                        phone: this.phone
                    }, metadata: this.metadata
                });
            if (!e.Status || !e.Data)
                throw new Error(e.Message || "Failed to create transaction");
            {
                const t = e.Data;
                this.transactionRef = t.Reference || t.reference,
                    this.totalAmount = this.amount,
                    this.serviceFee = 0
            }
        } catch (e) {
            this._hideLoading(),
                this.totalAmount = this.amount,
                this.transactionRef = this.reference,
                this.serviceFee = 0,
                "function" == typeof this.onError && this.onError({ message: e.message, step: "init" })
        } this._hideLoading(),
            this._render()
    }
    _render() {
        this._remove("egp-backdrop"); const e = document.createElement("div"); e.id = "egp-backdrop",
            e.addEventListener("click", t => { t.target === e && this.close("BACKDROP_CLICK") }), e.innerHTML = `\n    <div id="egp-modal" role="dialog" aria-modal="true" aria-label="Payment">\n        \x3c!-- sidebar --\x3e\n        <div id="egp-sidebar">\n            <img src="${this.companyLogo}" alt="EgolePay">\n            \x3c!-- CHANGED: Amount due box is now at the top, right below logo --\x3e\n            <div class="egp-amount-box">\n                <div class="lbl">Amount due</div>\n                <div class="val">${this._fmt(this.totalAmount)}</div>\n                <div class="sub">${this.serviceFee ? "Includes fee: " + this._fmt(this.serviceFee) : "&nbsp;"}</div>\n            </div>\n            <p class="egp-sb-tagline">Fast &amp; secure payments</p>\n            <div class="egp-sb-secure">Secured by EgolePay</div>\n        </div>\n\n        \x3c!-- main --\x3e\n        <div id="egp-main" style="position:relative;">\n            <button id="egp-close-btn" aria-label="Close payment" title="Close">&#10005;</button>\n\n            <div id="egp-main-header">\n                <h2>Complete your payment</h2>\n                <p>Choose a payment method below</p>\n            </div>\n\n            <div class="egp-tabs">\n                <button class="egp-tab"        data-tab="egp-panel-wallet">Balance</button>\n                <button class="egp-tab active" data-tab="egp-panel-card">Card</button>\n                <button class="egp-tab"        data-tab="egp-panel-transfer">Bank Transfer</button>\n                <button class="egp-tab" data-tab="egp-panel-qr" hidden aria-hidden="true">QR Code</button>\n            </div>\n\n            <div id="egp-panels">\n\n                \x3c!-- WALLET PANEL --\x3e\n                <div id="egp-panel-wallet" class="egp-panel">\n                    <div id="egp-status-wallet" class="egp-status"></div>\n\n                    \x3c!-- Wallet info + pay form --\x3e\n                    <div id="egp-wallet-form">\n                        <div class="egp-bank-box" style="margin-bottom:16px;">\n                            <div class="egp-bank-row">\n                                <span class="lbl">Main Wallet</span>\n                                <span class="val" id="egp-wallet-id">—</span>\n                            </div>\n                            <div class="egp-bank-row">\n                                <span class="lbl">Account Name</span>\n                                <span class="val" id="egp-wallet-name">—</span>\n                            </div>\n                            <div class="egp-bank-row">\n                                <span class="lbl">Balance</span>\n                                <span class="val accent" id="egp-wallet-balance">Loading...</span>\n                            </div>\n                        </div>\n                        <button class="egp-btn egp-btn-primary" id="egp-btn-wallet-pay">Pay ${this._fmt(this.totalAmount)}</button>\n                        <button class="egp-btn egp-btn-secondary" id="egp-btn-wallet-cancel">Cancel</button>\n                    </div>\n\n                </div>\n\n                \x3c!-- CARD PANEL --\x3e\n                <div id="egp-panel-card" class="egp-panel active">\n                    <div id="egp-status-card" class="egp-status"></div>\n                    <div id="egp-card-form">\n                        <label class="egp-label">Card number</label>\n                        <input class="egp-input" id="egp-card-number" type="text" placeholder="1234 5678 9012 3456" maxlength="23" autocomplete="cc-number">\n                        <div class="egp-row">\n                            <div>\n                                <label class="egp-label">Expiry</label>\n                                <input class="egp-input" id="egp-card-expiry" type="text" placeholder="MM/YY" maxlength="5" autocomplete="cc-exp">\n                            </div>\n                            <div>\n                                <label class="egp-label">CVV</label>\n                                <input class="egp-input" id="egp-card-cvv" type="text" placeholder="123" maxlength="4" autocomplete="cc-csc">\n                            </div>\n                        </div>\n                        <label class="egp-label">Card PIN</label>\n                        <input class="egp-input" id="egp-card-pin" type="password" placeholder="••••" maxlength="4">\n                        <button class="egp-btn egp-btn-primary" id="egp-btn-pay">Pay ${this._fmt(this.totalAmount)}</button>\n                        <button class="egp-btn egp-btn-secondary" id="egp-btn-card-cancel">Cancel</button>\n                    </div>\n                    \x3c!-- OTP section --\x3e\n                    <div id="egp-otp-section" style="display:none;">\n                        <div id="egp-status-otp" class="egp-status"></div>\n                        <p id="egp-otp-msg" style="font-size:14px;color:#475569;margin-bottom:14px;">Enter the 6-digit OTP sent to your phone.</p>\n                        <input class="egp-input egp-otp-input" id="egp-otp-code" type="text" placeholder="••••••" maxlength="6">\n                        <button class="egp-btn egp-btn-primary" id="egp-btn-otp-verify">Verify OTP</button>\n                        <button class="egp-btn egp-btn-secondary" id="egp-btn-otp-back">&#8592; Back</button>\n                    </div>\n                </div>\n\n                \x3c!-- TRANSFER PANEL --\x3e\n                <div id="egp-panel-transfer" class="egp-panel">\n                    <div id="egp-status-transfer" class="egp-status"></div>\n                    <div id="egp-transfer-init">\n                        <p style="font-size:14px;color:#475569;">Generate a one-time virtual account and transfer the exact amount shown.</p>\n                        <button class="egp-btn egp-btn-primary" id="egp-btn-get-account">Get account details</button>\n                        <button class="egp-btn egp-btn-secondary" id="egp-btn-transfer-cancel">Cancel</button>\n                    </div>\n                    <div id="egp-transfer-details" style="display:none;">\n                        <div class="egp-bank-box" id="egp-bank-box"></div>\n                        <div class="egp-expiry-notice" id="egp-expiry-notice"></div>\n                        <button class="egp-btn egp-btn-primary" id="egp-btn-i-paid">I have paid &#8594;</button>\n                        <button class="egp-btn egp-btn-secondary" id="egp-btn-transfer-back">&#8592; Try another method</button>\n                    </div>\n                </div>\n\n                \x3c!-- QR CODE PANEL --\x3e\n                <div id="egp-panel-qr" class="egp-panel">\n                    <div id="egp-status-qr" class="egp-status"></div>\n                    <div style="text-align:center;padding:10px 0;">\n\x3c!--                        <p style="font-size:14px;color:#475569;margin-bottom:16px;">Scan the QR code below to complete your payment.</p>--\x3e\n                        <p style="font-size:14px;color:#475569;margin-bottom:16px;">Coming Soon!</p>\n                        <div id="egp-qr-code" style="display:inline-block;padding:16px;border:1.5px solid #e2e8f0;border-radius:12px;background:#f8fafc;">\n                            <p style="color:#94a3b8;font-size:13px;margin:0;">Generating QR code...</p>\n                        </div>\n                        <p style="font-size:12px;color:#94a3b8;margin-top:12px;">Amount: <strong>${this._fmt(this.totalAmount)}</strong></p>\n                    </div>\n                    <button class="egp-btn egp-btn-secondary" style="margin-top:16px;" id="egp-btn-qr-cancel">Cancel</button>\n                </div>\n\n            </div>\n        </div>\n    </div>\n    `,
            document.body.appendChild(e),
            this._bindEvents(),
            this._loadWalletBalance()
    }
    _bindEvents() {
        document.querySelectorAll(".egp-tab").forEach(e =>
        {
            e.addEventListener("click", () => {
                document.querySelectorAll(".egp-tab")
                    .forEach(e => e.classList.remove("active")),
                    document.querySelectorAll(".egp-panel")
                        .forEach(e => e.classList.remove("active")),
                    e.classList.add("active");
                const t = this._el(e.dataset.tab); t && t.classList.add("active"),
                    "egp-panel-wallet" === e.dataset.tab && this._loadWalletBalance()
            })
        }), this._el("egp-close-btn").addEventListener("click", () => this.close("USER_CLOSED")),
            this._el("egp-card-number").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").substring(0, 19).replace(/(.{4})/g, "$1 ").trim() }),
            this._el("egp-card-expiry").addEventListener("input", e => { let t = e.target.value.replace(/\D/g, ""); t.length >= 3 && (t = t.slice(0, 2) + "/" + t.slice(2, 4)), e.target.value = t }),
            this._el("egp-card-cvv").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").substring(0, 4) }),
            this._el("egp-card-pin").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").substring(0, 4) }),
            this._el("egp-otp-code").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").substring(0, 6) }),
            this._el("egp-btn-pay").addEventListener("click", () => this._handleCardPayment()),
            this._el("egp-btn-card-cancel").addEventListener("click", () => this._cancel()),
            this._el("egp-btn-otp-verify").addEventListener("click", () => this._handleOtpSubmit()),
            this._el("egp-btn-otp-back").addEventListener("click", () => {
                this._el("egp-otp-section").style.display = "none",
                this._el("egp-card-form").style.display = "block", this.pendingPaymentRef = null, this.pendingThreeDS = null
            }),
            this._el("egp-btn-wallet-pay").addEventListener("click", () => this._promptWalletPin()), this._el("egp-btn-wallet-cancel").addEventListener("click", () => this._cancel()),
            this._el("egp-btn-qr-cancel").addEventListener("click", () => this._cancel()),
            this._el("egp-btn-get-account").addEventListener("click", () => this._handleInitiateTransfer()),
            this._el("egp-btn-transfer-cancel").addEventListener("click", () => this._cancel()), this._el("egp-btn-transfer-back").addEventListener("click", () => {
                this.transferDetails = null,
                this._el("egp-transfer-init").style.display = "block", this._el("egp-transfer-details").style.display = "none", this._hideStatus("egp-status-transfer")
            }), this._el("egp-btn-i-paid").addEventListener("click", () => this._handleVerifyTransfer())
    }
    async _loadWalletBalance() {
        const e = this._el("egp-wallet-balance"),
            t = this._el("egp-wallet-id"), n = this._el("egp-wallet-name"); e && (e.textContent = "Loading...");
        try {
            const a = await this._post("/transactions/wallet/balance",
                {
                    guidID: this.userID,
                    JwtToken: this.tnxBearer
                });
            if (!a.Status || !a.Data) throw new Error(a.Message || "Could not load balance");
            const s = a.Data; t && (t.textContent = s.MainWallet || "—"),
                n && (n.textContent = s.BusinessName || "—"),
                e && (e.textContent = this._fmt(s.WalletBalance || 0)),
                s.MainWallet && (this.mainAcctNumber = s.MainWallet)
        } catch (t) {
            e && (e.textContent = "Unavailable"),
                this._showStatus("egp-status-wallet", "error", "Could not load wallet balance: " + t.message)
        }
    }
    _promptWalletPin() {
        if (this._walletPaid) return; this._remove("egp-pin-overlay");
        let e = "";
        const t = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let e = t.length - 1; e > 0; e--)
        { const n = Math.floor(Math.random() * (e + 1));[t[e], t[n]] = [t[n], t[e]] }
        const n = [...t, "", "⌫"],
            a = document.createElement("div");
        a.id = "egp-pin-overlay", a.innerHTML = `\n            <div class="egp-pin-card">\n                <h3>Enter your Wallet PIN</h3>\n                <p>Confirm your 4-digit PIN to authorise this payment</p>\n                <div id="egp-pin-status" class="egp-status" style="margin-bottom:12px;"></div>\n                <div class="egp-pin-dots" id="egp-pin-dots">\n                    <div class="egp-pin-dot" id="pd0"></div>\n                    <div class="egp-pin-dot" id="pd1"></div>\n                    <div class="egp-pin-dot" id="pd2"></div>\n                    <div class="egp-pin-dot" id="pd3"></div>\n                </div>\n                <div class="egp-pin-keypad" id="egp-pin-keypad">\n                    ${n.map(e => "" === e ? "<div></div>" : "⌫" === e ? '<button class="egp-pin-key del" data-key="del">⌫</button>' : `<button class="egp-pin-key" data-key="${e}">${e}</button>`).join("")}\n                </div>\n                <button class="egp-btn egp-btn-primary" id="egp-pin-submit" disabled>Confirm Payment</button>\n                <button class="egp-btn egp-btn-secondary" id="egp-pin-cancel" style="margin-top:8px;">Cancel</button>\n            </div>\n        `, document.body.appendChild(a); const s = () => { for (let t = 0; t < 4; t++) { const n = this._el(`pd${t}`); n && n.classList.toggle("filled", t < e.length) } const t = this._el("egp-pin-submit"); t && (t.disabled = 4 !== e.length) }, i = t => { "del" === t ? e = e.slice(0, -1) : e.length < 4 && (e += t), s() }; a.querySelectorAll(".egp-pin-key").forEach(e => { e.addEventListener("click", () => i(e.dataset.key)) }); const r = t => {
            t.key >= "0" && t.key <= "9" ? (t.preventDefault(), i(t.key)) : "Backspace" === t.key ? (t.preventDefault(), i("del")) : "Enter" === t.key && 4 === e.length && (t.preventDefault(),
                this._verifyWalletPin(e))
        };
        document.addEventListener("keydown", r);
        const o = () => document.removeEventListener("keydown", r);
        this._el("egp-pin-cancel").addEventListener("click", () => { o(), this._remove("egp-pin-overlay") }),
            this._el("egp-pin-submit").addEventListener("click", () => { o(), this._verifyWalletPin(e) })
    }
    async _verifyWalletPin(e) {
        const t = this._el("egp-pin-status"),
            n = this._el("egp-pin-submit"),
            a = this._el("egp-pin-cancel");
        t && (t.className = "egp-status"),
            n && (n.disabled = !0, n.innerHTML = '<span class="egp-spinner"></span>Verifying...'), a && (a.disabled = !0);
        try {
            const t = await this.enc.encrypt({ Pin: e, UserID: parseInt(this.userID), mainAcctNumber: this.mainAcctNumber }),
                n = await this._post("/transactions/auth",
                    {
                        payload: t.encryptedData,
                        Token: this.tnxBearer
                    }),
                a = n.Data || n; if (!0 !== n.Status && "00" !== a.statuscode && "200" !== a.statuscode) throw new Error(a.Message || n.Message || "Incorrect PIN. Please try again.");
            this._remove("egp-pin-overlay"), await this._handleWalletPayment()
        } catch (e) {
            n && (n.disabled = !1, n.innerHTML = "Confirm Payment"),
                a && (a.disabled = !1),
                t && (t.className = "egp-status error show",
                    t.textContent = e.message || "PIN verification failed. Please try again.")
        }
    }
    async _handleWalletPayment() {
        if (this._walletPaid) return; this._showLoading("Processing wallet payment...");
        const e = this._el("egp-btn-wallet-pay"); e && (e.disabled = !0);
        try {
            const t = await this._post(`/transactions/${this.transactionRef}/payments/balance`,
                {
                    guidID: this.userID,
                    jwtToken: this.tnxBearer,
                    tnxType: this.tnxType,
                    payload: this.payload,
                    paymentReference: this.transactionRef,
                    email: this.email
                });
            if (this._hideLoading(), t.Status && t.Data)
            {
                this._walletPaid = !0;
                const e = t.Data.PaymentRef || t.Data.Reference || this.transactionRef;
                this._populateReceipt(
                    {
                        TransactionReference: this.transactionRef,
                        PaymentRef: e, Amount: t.Data.Amount || this.totalAmount,
                        Status: "success",
                        PaidAt: (new Date).toISOString(),
                        Environment: this.isTestMode ? "test" : "live"
                    },
                    "Wallet"),
                    this._updateStep("success"),
                    this._showResultModal(
                        {
                            status: "success",
                            payRef: e,
                            channel: "Wallet",
                            data: t.Data
                        })
            } else {
                e && (e.disabled = !1);
                const n = t.Message || "Wallet payment failed. Please try again.";
                this._showStatus("egp-status-wallet", "error", n), "function" == typeof this.onError && this.onError({ message: n, step: "wallet_pay" })
            }
        } catch (t) {
            this._hideLoading(), e && (e.disabled = !1);
            const n = t.message || "An unexpected error occurred. Please try again.";
            this._showStatus("egp-status-wallet", "error", n), "function" == typeof this.onError && this.onError({ message: n, step: "wallet_pay" })
        }
    }
    async _handleCardPayment() {
        this._hideStatus("egp-status-card"); const e = this._el("egp-card-number").value.replace(/\s/g, ""),
            t = this._el("egp-card-expiry").value,
            n = this._el("egp-card-cvv").value.trim(), a = this._el("egp-card-pin").value.trim();
        if (e.length < 15) return this._showStatus("egp-status-card", "error", "Please enter a valid card number.");
        if (!t.includes("/")) return this._showStatus("egp-status-card", "error", "Please enter expiry as MM/YY."); if (n.length < 3)
            return this._showStatus("egp-status-card", "error", "Please enter a valid CVV.");
        if (a.length < 4) return this._showStatus("egp-status-card", "error", "Please enter your 4-digit PIN.");
        if (!this.transactionRef) return this._showStatus("egp-status-card", "error", "Transaction not initialised. Please refresh.");
        const [s, i] = t.split("/"), r = this._el("egp-btn-pay"); r.disabled = !0, r.innerHTML = '<span class="egp-spinner"></span>Processing...';
        try { const t = await this._post(`/transactions/${this.transactionRef}/payments/card`, { amount: this.totalAmount, email: this.email, card: { number: e, expiryMonth: s, expiryYear: i, cvv: n, pin: a, saveCard: !1 }, saveCard: !1, description: "Card payment" }); if (r.disabled = !1, r.innerHTML = `Pay ${this._fmt(this.totalAmount)}`, t.Status && t.Data) { const e = t.Data; if (this._updateStep("card_payment"), e.Requires3DS && e.ThreeDSecure) this.pendingPaymentRef = e.PaymentReference, this.pendingThreeDS = e.ThreeDSecure, this._showOtpSection(!0); else if ("success" === e.Status || "00" === e.ResponseCode) e.Token && (this.savedToken = e.Token), this._populateReceipt(e, "Card"), this._showResultModal({ status: "success", payRef: e.PaymentRef || e.PaymentReference, channel: "Card", data: e }); else if ("pending" === e.Status || "02" === e.ResponseCode || "T0" === e.ResponseCode) this.pendingPaymentRef = e.PaymentReference, this._showOtpSection(!1); else { const t = e.Message || "Payment declined. Please try again."; this._showResultModal({ status: "error", channel: "Card", message: t }), "function" == typeof this.onError && this.onError({ message: t, step: this.currentStep }) } } else { const e = t.Errors, n = e ? Object.values(e).flat()[0] : t.Message || "Payment failed."; this._showResultModal({ status: "error", channel: "Card", message: n }), "function" == typeof this.onError && this.onError({ message: n, step: this.currentStep }) } } catch (e) { r.disabled = !1, r.innerHTML = `Pay ${this._fmt(this.totalAmount)}`; const t = e.message || "An unexpected error occurred."; this._showResultModal({ status: "error", channel: "Card", message: t }), "function" == typeof this.onError && this.onError({ message: t, step: this.currentStep }) }
    }
    _showOtpSection(e) {
        this._el("egp-card-form").style.display = "none", this._el("egp-otp-section").style.display = "block",
        this._el("egp-otp-msg").textContent = e ? "3DS authentication required. Enter the code sent by your bank." : "Enter the 6-digit OTP sent to your registered phone.", this._hideStatus("egp-status-otp")
    }
    async _handleOtpSubmit() {
        this._hideStatus("egp-status-otp");
        const e = this._el("egp-otp-code").value; if (6 !== e.length) return this._showStatus("egp-status-otp", "error", "Please enter a valid 6-digit OTP."); const t = this._el("egp-btn-otp-verify"); t.disabled = !0, t.innerHTML = '<span class="egp-spinner"></span>Verifying...'; try { const n = await this._post(`/transactions/${this.transactionRef}/payments/card/otp`, { guidID: this.userID, jwtToken: this.tnxBearer, tnxType: this.tnxType, payload: this.payload, paymentReference: this.pendingPaymentRef, otp: e, authData: this.pendingThreeDS, email: this.email }), a = n.Data || n.data; if (!n.Status && !n.status || !a || "success" !== a.Status && "success" !== a.status) { t.disabled = !1, t.innerHTML = "Verify OTP"; const e = a && (a.Message || a.message) || n.Message || "OTP verification failed."; this._showResultModal({ status: "error", channel: "Card", message: e }), "function" == typeof this.onError && this.onError({ message: e, step: this.currentStep }) } else t.innerHTML = "Verified", this._populateReceipt(a, "Card"), this._showResultModal({ status: "success", payRef: this.pendingPaymentRef, channel: "Card", data: a }) } catch (e) { t.disabled = !1, t.innerHTML = "Verify OTP"; const n = e.message || "OTP verification failed."; this._showResultModal({ status: "error", channel: "Card", message: n }), "function" == typeof this.onError && this.onError({ message: n, step: this.currentStep }) }
    }
    async _handleInitiateTransfer() {
        if (this._hideStatus("egp-status-transfer"), !this.transactionRef)
            return this._showStatus("egp-status-transfer", "error", "Transaction not initialised. Please refresh.");
        const e = this._el("egp-btn-get-account"); e.disabled = !0, e.innerHTML = '<span class="egp-spinner"></span>Generating account...';
        try {
            const t = await this._post(`/transactions/${this.transactionRef}/transfers/initiate`, {});
            e.disabled = !1, e.innerHTML = "Get account details", t.Status
                && t.Data ? (this.transferDetails = t.Data, this._renderBankBox(t.Data),
                this._el("egp-transfer-init").style.display = "none",
                this._el("egp-transfer-details").style.display = "block",
                this._showStatus("egp-status-transfer", "info", "Transfer to the account below then click <strong>I have paid</strong>. Do not close this page."), this._updateStep("transfer_details")) : this._showStatus("egp-status-transfer", "error", t.Message || "Could not generate account details.")
        } catch (t) { e.disabled = !1, e.innerHTML = "Get account details", this._showStatus("egp-status-transfer", "error", t.message || "An error occurred."), "function" == typeof this.onError && this.onError({ message: t.message, step: this.currentStep }) }
    }
    _renderBankBox(e) {
        this._el("egp-bank-box").innerHTML = `\n            <div class="egp-bank-row"><span class="lbl">Bank</span><span class="val">${e.BankName}</span></div>\n            <div class="egp-bank-row">\n                <span class="lbl">Account number</span>\n                <span class="val" style="display:flex;align-items:center;gap:8px;">\n                    <span id="egp-acct-num">${e.AccountNumber}</span>\n                    <button class="egp-copy-btn" id="egp-copy-acct">Copy</button>\n                </span>\n            </div>\n            <div class="egp-bank-row"><span class="lbl">Account name</span><span class="val">${e.AccountName}</span></div>\n            <div class="egp-bank-row"><span class="lbl">Amount</span><span class="val accent">${this._fmt(e.Amount)}</span></div>\n        `,
        this._el("egp-expiry-notice").innerHTML = `This account expires at <strong>${new Date(e.ExpiresAt).toLocaleTimeString()}</strong> (${e.ExpiryTime}). Transfer the <strong>exact</strong> amount shown.`, this._el("egp-copy-acct").addEventListener("click", () => { const e = this._el("egp-acct-num").textContent; navigator.clipboard.writeText(e).then(() => { const e = this._el("egp-copy-acct"); e.textContent = "Copied!", setTimeout(() => e.textContent = "Copy", 2e3) }) })
    } async _handleVerifyTransfer() {
        this._hideStatus("egp-status-transfer"); const e = this.transferDetails; if (!e) return this._showStatus("egp-status-transfer", "error", "Transfer details missing. Please restart."); const t = this._el("egp-btn-i-paid"); t.disabled = !0, t.innerHTML = '<span class="egp-spinner"></span>Verifying...'; try {
            const n = e.TransactionReference || this.transactionRef, a = e.TransferReference,
            s = await this._post(`/transactions/${n}/${a}/transfers/verify`, { guidID: this.userID, jwtToken: this.tnxBearer, tnxType: this.tnxType, payload: this.payload, sourceAcct: e.AccountNumber, paymentReference: a, email: this.email }); if (s.Status && s.Data) { const e = s.Data, i = (e.Status || "").toLowerCase(); if ("success" === i) { t.innerHTML = "Verified"; const s = e.PaymentRef || a; this._populateReceipt({ TransactionReference: n, PaymentRef: s, Amount: e.Amount || this.totalAmount, Status: "success", PaidAt: (new Date).toISOString(), Environment: this.isTestMode ? "test" : "live" }, "Transfer"), this._updateStep("success"), this._showResultModal({ status: "success", payRef: s, channel: "Transfer", data: e }) } else if ("pending" === i) t.disabled = !1, t.innerHTML = "I have paid &#8594;", this._showStatus("egp-status-transfer", "info", "Payment not yet received. Please wait a moment and try again."); else { t.disabled = !1, t.innerHTML = "I have paid &#8594;"; const n = e.Message || "Verification failed."; this._showResultModal({ status: "error", channel: "Transfer", message: n }), "function" == typeof this.onError && this.onError({ message: n, step: this.currentStep }) } } else { t.disabled = !1, t.innerHTML = "I have paid &#8594;"; const e = s.Message || "Verification failed. Please try again."; this._showResultModal({ status: "error", channel: "Transfer", message: e }), "function" == typeof this.onError && this.onError({ message: e, step: this.currentStep }) }
        } catch (e) { t.disabled = !1, t.innerHTML = "I have paid &#8594;"; const n = e.message || "Verification error."; this._showResultModal({ status: "error", channel: "Transfer", message: n }), "function" == typeof this.onError && this.onError({ message: n, step: this.currentStep }) }
    }
    /* ---- e-Receipt (shared EgolePayReceipt block) ---- */
    buildReceipt(status = "success", details = {}) {
        let paidAt = details.paidAt ? new Date(details.paidAt) : new Date();
        if (isNaN(paidAt.getTime())) paidAt = new Date();
        const total = Number(details.total || this.totalAmount || this.amount) || 0;
        const receipt = {
            merchantReference: this.reference || "",
            gatewayReference: this.transactionRef || "",
            paymentReference: details.paymentReference || this.transactionRef || "",
            status,
            statusLabel: this._statusLabel(status),
            message: details.message || "",
            total,
            currency: "NGN",
            description: details.description || this.metadata.description || "Payment",
            channel: details.channel || "N/A",
            paidAt: paidAt.toISOString(),
            paidAtLabel: this._formatReceiptDate(paidAt),
            customer: { name: this.customerName || "", email: this.email || "", phone: this.phone || "" },
            merchantName: "",
            card: details.card || null,
            bank: details.bank || null,
            metadata: this.metadata || {},
            mode: this.isTestMode ? "TEST" : "LIVE",
            issuer: "EgolePay",
            externalReceipts: this._parseExternalReceipts(details.receiptUrls || [], details.receiptNames || []),
        };
        receipt.verificationCode = this._sealReceipt(receipt);
        return receipt;
    }
    /* Called by every settled path with the gateway payload and the channel. */
    _populateReceipt(e, t) {
        const bank = this.transferDetails && "Transfer" === t
            ? { bankName: this.transferDetails.BankName, accountNumber: this.transferDetails.AccountNumber }
            : null;
        this._receipt = this.buildReceipt("success", {
            paymentReference: e.PaymentRef || e.PaymentReference || e.Reference || this.transactionRef,
            total: e.Amount || this.totalAmount,
            channel: { Card: "Card", Transfer: "Bank Transfer", Wallet: "Wallet" }[t] || t,
            paidAt: e.PaidAt,
            card: e.MaskedPan ? { maskedPan: e.MaskedPan } : null,
            bank,
        });
    }
    /* success -> shared result modal with the e-Receipt, shell hidden beneath.
     * error   -> same modal, no receipt, Try Again (back to the form) / Cancel. */
    _showResultModal({ status: e, payRef: t = "", channel: n = "", message: a = "", data: s = {} }) {
        this._remove("egp-result-overlay");
        const i = "success" === e, shell = this._el("egp-modal");
        if (i) {
            shell && (shell.style.display = "none");
            if (!this._receipt) this._populateReceipt({ PaymentRef: t, Amount: this.totalAmount }, n);
            this._mountResultModal({
                status: "success",
                message: a,
                receipt: this._receipt,
                onDone: () => {
                    this._removeResultModal();
                    "function" == typeof this.onSuccess && this.onSuccess({
                        status: "success", amount: this.amount, channel: n,
                        transactionReference: this.transactionRef, paymentReference: t,
                        token: this.savedToken, receipt: this._receipt, ...s
                    });
                    this.close("PAYMENT_SUCCESSFUL");
                },
            });
        } else {
            this._mountResultModal({
                status: "failed",
                message: a || "Your payment could not be completed.",
                receipt: null,
                retry: () => this._removeResultModal(),
                retryLabel: "Try Again",
                doneLabel: "Cancel",
                onDone: () => { this._removeResultModal(); this._cancel(); },
            });
        }
    }
    destroy() {
        this.close("DESTROYED"),
        this.onSuccess = this.onCancel = this.onError = this.onClose = this.onStepChange = null
    }
}
Object.assign(EgolePay.prototype, EgolePayReceipt);
"undefined" != typeof module && module.exports ? module.exports = EgolePay : window.EgolePay = EgolePay;