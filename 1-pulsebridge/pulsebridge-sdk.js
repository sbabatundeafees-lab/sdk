// Payload Encryption......  
class PayloadEncryption {
    constructor(rsaPublicKey = null) {
        this.rsaPublicKey = rsaPublicKey || `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt0KgRHBhfBbGM3hjrzSG
ueU9qgmkz9K5rTRGSSOznfOCJxTv4Wb46+/Hvvolh/fqgDMFzu9ygcbqw1BanLIR
UySFbChqw7KudC8LF+D/QaHCoOsy3ce4HZXsdCmqWwH3j0eyP+WAZnezYW6ZYMzp
RHeQoFMqNoEVZzc8Qnhd1T74oTpqmodr0pElw7s9yw1ckSfLDSVI9QRdIneaBYiI
uCVbFtmIgM26BsRVwYTXvkMZEbJpTMeWheRr3WLlS9tHFMAPAM3HQ+TDFgOaKyqF
OTjsJBv4Xeqbmrva+wTOOnLhYOPbVHlfhD+Jqu3phkCIIki8nFE9ZPUlYf/qP6Bn
9QIDAQAB
-----END PUBLIC KEY-----`
    }

    generateRandomBytes(length) {
        const array = new Uint8Array(length)
        crypto.getRandomValues(array)
        return array
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer)
        let binary = ""
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        return btoa(binary)
    }

    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }
        return bytes.buffer
    }

    async importRSAKey(pemKey) {
        try {
            const pemContents = pemKey
                .replace(/-----BEGIN PUBLIC KEY-----/, "")
                .replace(/-----END PUBLIC KEY-----/, "")
                .replace(/\s/g, "")

            const keyData = this.base64ToArrayBuffer(pemContents)

            return await crypto.subtle.importKey("spki", keyData, {
                name: "RSA-OAEP", hash: "SHA-256",
            }, false, ["encrypt"])
        } catch (error) {
            throw new Error(`Failed to import RSA key: ${error.message}`)
        }
    }

    async encryptWithAES(data, key, iv) {
        try {
            const encoder = new TextEncoder()
            const dataBuffer = encoder.encode(data)

            const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt"])

            const encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv: iv }, cryptoKey, dataBuffer)

            return this.arrayBufferToBase64(encrypted)
        } catch (error) {
            throw new Error(`AES encryption failed: ${error.message}`)
        }
    }

    async encryptAESKeyWithRSA(aesKey, rsaKey) {
        try {
            const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsaKey, aesKey)

            return this.arrayBufferToBase64(encrypted)
        } catch (error) {
            throw new Error(`RSA encryption failed: ${error.message}`)
        }
    }

    async encrypt(payload, rsaPublicKey = null) {
        try {

            const publicKeyPem = rsaPublicKey || this.rsaPublicKey

            // Generate 256-bit AES Key and 16-byte IV
            const aesKey = this.generateRandomBytes(32)
            const iv = this.generateRandomBytes(16)

            // Import RSA public key
            const rsaKey = await this.importRSAKey(publicKeyPem)

            // Encrypt the payload using AES
            const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload)
            const encryptedData = await this.encryptWithAES(payloadString, aesKey, iv)

            // Encrypt the AES key using RSA
            const encryptedAESKey = await this.encryptAESKeyWithRSA(aesKey, rsaKey)

            // Create intermediate structure
            const intermediate = {
                EncryptedAesKey: encryptedAESKey, IV: this.arrayBufferToBase64(iv), EncryptedData: encryptedData,
            }

            // Convert to base64 and create final payload
            const jsonString = JSON.stringify(intermediate)
            const base64EncodedPayload = btoa(jsonString)

            // Return final format
            return {
                encryptedData: base64EncodedPayload,
            }
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`)
        }
    }

    isSupported() {
        return (typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined" && typeof crypto.getRandomValues !== "undefined")
    }

    setRSAPublicKey(publicKey) {
        this.rsaPublicKey = publicKey
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

class InlineJS {
    constructor(options = {}) {
        //// Validate required parameters
        //if (!options.txnRef) {
        //    throw new Error("txnRef is required for initialization");
        //}
        // Guests get blank contact fields on the transfer form; existing customers get them pre-filled.
        this.isGuest = !!options.isGuest
        if (!options.email && !this.isGuest) {
            throw new Error("email is required for initialization");
        }
        //if (!options.type || !["webguid", "harmonized"].includes(options.type.toLowerCase())) {
        //    throw new Error("refType must be 'webguid' or 'harmonized'");
        //}
        // Initialize basic properties first
        this.pan = options.pan || ""
        this.expiry = options.expiry || ""
        this.amount = options.amount || 0
        this.cvv = options.cvv || ""
        this.cardholder = options.cardholder || ""
        this.mobile = options.mobile || options.phone || ""
        this.email = options.email || ""
        this.pin = options.pin || ""
        this.product = options.description || ""
        this.description = options.description || ""
        this.currency = options.currency || "NGN"
        this.txnRef = options.txnRef || "";  // Use txnRef instead of tnxRef
        this.refType = options.type || "";  // Use refType instead of Reftype
        this.companyLogo = "https://res.cloudinary.com/dl9m2dzgk/image/upload/v1725615415/MicrosoftTeams-image_7_sjbwtk.png"
        this.merchantId = options.merchantId || "LyrtqeSN+NdodrneYXZ7revmAmVhJk00NhlMmGGdK4/pAQDKnqKkfNu8oJ8l5iFavh+wo6CUQ0ZpqHOd2xCAyZ/Oug=="
        this.apiKey = options.apiKey || "sk_test_REVABC_QXZbHtF6m_oed1QFPAAAY4jFGP3-jyM-wjhgfdf87655678"
        this.secretKey = options.secretKey || "sk_test_REVABC_QXZbHtF6m_oed1QFPAAAY4jFGP3-jyM-wjhgfdf87655678"
        //sk_test_VRXD_9fA3KQWm2E8LxR7HcD0PZB6JtN4YV5S1
        // API endpoints
        this.transactionEndpoint = "https://stage-gatewayservice.egolepay.com/api/PaymentEngine/ProcessTransactions"
        // this.paymentEndpoint = "https://stage-gatewayservice.egolepay.com/api/PaymentEngine/MakePayment"
        this.paymentEndpoint = "https://stage-gatewayservice.egolepay.com/api/PaymentEngine/MakePayment"
        this.vapaymentEndpoint = "https://stage-gatewayservice.egolepay.com/api/PaymentEngine/DynamicAccount"
        this.VerifypaymentEndpoint = "https://stage-gatewayservice.egolepay.com/api/PaymentEngine/Verify"
        this. billVerificationEndpoint = "https://stage-gatewayservice.egolepay.com/api/PaymentEngine/ValidateReference"
        // this.emailEndpoint = "https://stage-gatewayservice.egolepay.com/api/notification/WebPayment"
        this.emailEndpoint = "https://api-test.egolepay.com/api/notification/WebPayment"
        this.otpEndpoint = "https://stage-gatewayservice.egolepay.com/api/PaymentEngine/OTPAuthorization"
        this.onSuccess = options.onSuccess || function () {
        };
        this.onCancel = options.onCancel || function () {
        };
        this.onError = options.onError || function () {
        };
        this.onClose = options.onClose || function () {
        };
        this.onStepChange = options.onStepChange || function () {
        };

        // Track current step
        this.currentStep = "initial";

        // Initialize encryption utility with error handling
        try {
            this.encryption = new PayloadEncryption()
            // Test if encryption is working
            if (this.encryption && typeof this.encryption.isSupported === "function") {
            } else {
            }
        } catch (error) {
            this.encryption = null
        }

        // Verify encryption is properly set
        if (!this.encryption) {
            // Create a fallback
            try {
                this.encryption = new PayloadEncryption()
            } catch (fallbackError) {
            }
        }

        // Call init() at the very end
        this.init()

        // Add keyboard event listener for ESC key
        // In constructor, change:
        this.handleEscKey = (e) => {
            if (e.key === 'Escape') {
                this.handleClose("KEYBOARD_ESC");
            }
        };

        // Ensure it's properly bound
        document.addEventListener('keydown', this.handleEscKey.bind(this));
    }

    // Enhanced encryptPayload method with debugging
    async encryptPayload(payload) {

        try {
            if (!this.encryption) {
                throw new Error("Encryption utility not initialized")
            }

            if (typeof this.encryption.isSupported !== "function") {
                throw new Error("Encryption utility malformed")
            }

            if (!this.encryption.isSupported()) {
                throw new Error("Encryption not supported in this browser")
            }
            const result = await this.encryption.encrypt(payload)
            return result
        } catch (error) {
            throw error
        }
    }

    //getQueryParams() {
    //    // Now use this.txnRef and this.refType (class properties)
    //    const webGuid = this.txnRef;
    //    const type = this.refType;

    //    return { webGuid, type };
    //}

    getQueryParams() {
        const urlString = window.location.href
        const url = new URL(urlString)
        const params = url.searchParams

        // URL params win (hosted checkout redirects carry them), but fall back to the
        // values the merchant passed to the constructor so the SDK can be driven
        // directly from JS without a query string.
        const webGuid = params.get("ref") || this.txnRef || ""
        const type = params.get("type") || this.refType || ""
        return { webGuid, type }
    }

    verifyBill(webGuid, type) {
        const allowedTypes = ["webguid", "harmonized"];
        if (!allowedTypes.includes(type?.toLowerCase())) {
            this.hideOverlay();
            this.showErrTypeModal("Bill type error, bill not configured for payment.");
            return Promise.reject(new Error("Invalid bill type"));
        }

        return new Promise((resolve, reject) => {

            const requestBody = {
                // webGuid or the feRerence to be`
                webGuid: webGuid,
                state: "XXSG",
                clientId: "869017180657232",
                tellerId: "2547624",
                type: type
            };

            // ========== LOG REQUEST ==========

            // =====================================

            fetch(this.billVerificationEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            })
                .then((response) => {
                    // ========== LOG RESPONSE STATUS ==========

                    // =========================================

                    if (!response.ok) {
                        return response.json().then((errorData) => {
                            // ========== LOG ERROR RESPONSE ==========

                            // =======================================
                            throw new Error(errorData?.statusMessage || errorData?.StatusMessage || "Unknown error occurred");
                        });
                    }
                    return response.json();
                })
                .then((data) => {
                    // ========== LOG SUCCESS RESPONSE ==========

                    // ==========================================

                    // Handle both PascalCase and camelCase response keys
                    const webGuidPayload = data?.webGuidPayload || data?.WebGuidPayload;
                    const harmonizedPayload = data?.harmonizedPayload || data?.HarmonizedPayload;
                    const payload = webGuidPayload || harmonizedPayload;

                    // Top-level status/message
                    const topLevelStatus = data?.status || data?.Status || "";
                    const topLevelStatusMessage = data?.statusMessage || data?.StatusMessage || "";

                    // ========== LOG PARSED PAYLOAD ==========

                    // =========================================

                    const payloadStatus = payload?.status || payload?.Status || topLevelStatus || "";
                    const payloadStatusMessage = payload?.statusMessage || payload?.StatusMessage || topLevelStatusMessage || "An unknown error occurred";

                    if (payloadStatus.toLowerCase() === "failed") {
                        // ========== LOG FAILED STATUS ==========

                        // =======================================
                        this.hideOverlay();
                        this.showErrTypeModal(payloadStatusMessage);
                        return;
                    }

                    if (type?.toLowerCase() === "harmonized" && harmonizedPayload) {
                        // ========== LOG HARMONIZED ==========

                        // ====================================

                        setTimeout(() => {
                            const EditAmountToPay = document.getElementById("amount-to-pay");
                            const revenueCode = document.getElementById("RevenueCodeDiv");
                            const agencyCode = document.getElementById("AgencyCodeDiv");
                            if (EditAmountToPay) {
                                EditAmountToPay.readOnly = true;
                                EditAmountToPay.style.backgroundColor = "#f0f0f0";
                                revenueCode.style.cssText = "display: none !important;";
                                agencyCode.style.cssText = "display: none !important;";
                            }
                        }, 0);

                        const bulkBill = harmonizedPayload?.bulkBill || harmonizedPayload?.BulkBill;

                        const rawItems = bulkBill?.webguid || bulkBill?.WebGuid || bulkBill?.Webguid || [];
                        const items = rawItems.map((item) => ({
                            webGuid: item?.webguid || item?.Webguid || item?.WebGuid || item?.webGuid || "",
                            amountDue: String(item?.amountDue || item?.AmountDue || "0.00").replace(/,/g, ""),
                            creditAccount: item?.creditAccount || item?.CreditAccount || "",
                            currency: item?.currency || item?.Currency || "NGN",
                            paymentFlag: item?.paymentFlag || item?.PaymentFlag || "PartPayment",
                            cbnCode: item?.cbnCode || item?.CbnCode || "232",
                            revenueCode: item?.revenueCode || item?.RevenueCode || "",
                            revName: item?.revName || item?.RevName || "",
                            agencyCode: item?.agencyCode || item?.AgencyCode || "",
                            agencyName: item?.agencyName || item?.AgencyName || "",
                            oraAgencyRev: item?.oraAgencyRev || item?.OraAgencyRev || "",
                            acctCloseDate: item?.acctCloseDate || item?.AcctCloseDate || "",
                            readOnly: item?.readOnly || item?.ReadOnly || "No",
                            minAmount: item?.minAmount || item?.MinAmount || "0.0000",
                            maxAmount: item?.maxAmount || item?.MaxAmount || "",
                        }));

                        // TotalDue may be absent; fall back to the sum of the item amounts.
                        const itemsSum = items.reduce((sum, i) => sum + (Number.parseFloat(i.amountDue) || 0), 0);
                        const totalDue = String(bulkBill?.totalDue ?? bulkBill?.TotalDue ?? itemsSum).replace(/,/g, "");
                        const firstItem = items[0] || {};

                        const result = {
                            payerName: bulkBill?.payerName || bulkBill?.PayerName || "",
                            pid: bulkBill?.pid?.toString() || bulkBill?.Pid?.toString() || "",
                            state: bulkBill?.state || bulkBill?.State || "XXSG",
                            status: bulkBill?.status || bulkBill?.Status || "SUCCESS",
                            statusMessage: bulkBill?.statusMessage || bulkBill?.StatusMessage || "OK",
                            parentGUid: bulkBill?.parentGUid || bulkBill?.ParentGUid || "",
                            totalDue: totalDue,
                            amountDue: totalDue,
                            revName: firstItem.revName || "",
                            agencyName: firstItem.agencyName || "",
                            creditAccount: firstItem.creditAccount || "",
                            cbnCode: firstItem.cbnCode || "232",
                            items: items
                        };

                        // ========== LOG RESOLVED RESULT ==========

                        // =========================================
                        resolve(result);

                    } else if (type?.toLowerCase() === "webguid" && webGuidPayload) {
                        // ========== LOG WEBGUID ==========

                        // =================================

                        setTimeout(() => {
                            const selectItem = document.getElementById("selectItems");
                            if (selectItem) {
                                selectItem.style.cssText = "display: none !important;";
                            }
                        }, 10);

                        const result = {
                            webGuid: webGuidPayload?.webGuid || webGuidPayload?.WebGuid || "",
                            type: type,
                            amountDue: String(webGuidPayload?.amountDue || webGuidPayload?.AmountDue || "0.00").replace(/,/g, ""),
                            status: webGuidPayload?.status || webGuidPayload?.Status || "SUCCESS",
                            creditAccount: webGuidPayload?.creditAccount || webGuidPayload?.CreditAccount || "",
                            payerName: webGuidPayload?.payerName || webGuidPayload?.PayerName || "",
                            agencyCode: webGuidPayload?.agencyCode || webGuidPayload?.AgencyCode || "",
                            revenueCode: webGuidPayload?.revenueCode || webGuidPayload?.RevenueCode || "",
                            oraAgencyRev: webGuidPayload?.oraAgencyRev || webGuidPayload?.OraAgencyRev || "",
                            state: webGuidPayload?.state || webGuidPayload?.State || "XXSG",
                            statusMessage: webGuidPayload?.statusMessage || webGuidPayload?.StatusMessage || "OK",
                            pid: webGuidPayload?.pid || webGuidPayload?.Pid || "",
                            currency: webGuidPayload?.currency || webGuidPayload?.Currency || "NGN",
                            acctCloseDate: webGuidPayload?.acctCloseDate || webGuidPayload?.AcctCloseDate || "",
                            readOnly: webGuidPayload?.readOnly || webGuidPayload?.ReadOnly || "No",
                            minAmount: webGuidPayload?.minAmount || webGuidPayload?.MinAmount || "0.0000",
                            maxAmount: webGuidPayload?.maxAmount || webGuidPayload?.MaxAmount || "",
                            paymentFlag: webGuidPayload?.paymentFlag || webGuidPayload?.PaymentFlag || "PartPayment",
                            cbnCode: webGuidPayload?.cbnCode || webGuidPayload?.CbnCode || "232",
                            agencyName: webGuidPayload?.agencyName || webGuidPayload?.AgencyName || "",
                            revName: webGuidPayload?.revName || webGuidPayload?.RevName || "",
                        };

                        // ========== LOG RESOLVED RESULT ==========

                        // =========================================
                        resolve(result);

                    } else if (topLevelStatusMessage) {
                        // ========== LOG TOP LEVEL MESSAGE ==========

                        // ===========================================
                        this.hideOverlay();
                        this.showErrTypeModal(topLevelStatusMessage);
                        return;
                    } else {
                        // ========== LOG UNEXPECTED FORMAT ==========

                        // ===========================================
                        reject(new Error("Unexpected response format from server."));
                    }
                })
                .catch((error) => {
                    // ========== LOG CATCH ERROR ==========

                    // =====================================
                    reject(error);
                });
        });
    }

    verifyBillWithLog(webGuid, type) {
        const allowedTypes = ["webguid", "harmonized"];
        if (!allowedTypes.includes(type?.toLowerCase())) {
            this.hideOverlay();
            this.showErrTypeModal("Bill type error, bill not configured for payment.");
            return Promise.reject(new Error("Invalid bill type"));
        }

        return new Promise((resolve, reject) => {

            const requestBody = {
                //token: this.apiKey,
                webGuid: webGuid,
                state: "XXSG",
                clientId: "869017180657232",
                tellerId: "2547624",
                type: type
            };

            // Log as object
            // //console.log("Bill Verification Request:", requestBody);

            ////Log as JSON string
            // console.log("Bill Verification Request JSON:", JSON.stringify(requestBody, null, 2));

            fetch(this.billVerificationEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                //body: JSON.stringify({
                //    webGuid: webGuid,
                //    state: "XXSG",
                //    clientId: "869017180657232",
                //    tellerId: "2547624",
                //    type: type
                //}),
                body: JSON.stringify(requestBody, null, 2),
            })
                .then((response) => {
                    if (!response.ok) {
                        return response.json().then((errorData) => {
                            throw new Error(errorData?.statusMessage || errorData?.StatusMessage || "Unknown error occurred");
                        });
                    }
                    return response.json();
                })
                .then((data) => {
                    // Handle both PascalCase and camelCase response keys
                    const webGuidPayload = data?.webGuidPayload || data?.WebGuidPayload;
                    const harmonizedPayload = data?.harmonizedPayload || data?.HarmonizedPayload;
                    const payload = webGuidPayload || harmonizedPayload;

                    // Top-level status/message, e.g. { "Status":"FAILED", "StatusMessage":"Reference fully paid" }
                    const topLevelStatus = data?.status || data?.Status || "";
                    const topLevelStatusMessage = data?.statusMessage || data?.StatusMessage || "";

                    const payloadStatus = payload?.status || payload?.Status || topLevelStatus || "";
                    const payloadStatusMessage = payload?.statusMessage || payload?.StatusMessage || topLevelStatusMessage || "An unknown error occurred";

                    if (payloadStatus.toLowerCase() === "failed") {
                        this.hideOverlay();
                        this.showErrTypeModal(payloadStatusMessage);
                        return;
                    }

                    if (type?.toLowerCase() === "harmonized" && harmonizedPayload) {
                        setTimeout(() => {
                            const EditAmountToPay = document.getElementById("amount-to-pay");
                            const revenueCode = document.getElementById("RevenueCodeDiv");
                            const agencyCode = document.getElementById("AgencyCodeDiv");
                            if (EditAmountToPay) {
                                EditAmountToPay.readOnly = true;
                                EditAmountToPay.style.backgroundColor = "#f0f0f0";
                                revenueCode.style.cssText = "display: none !important;";
                                agencyCode.style.cssText = "display: none !important;";
                            }
                        }, 0);

                        const bulkBill = harmonizedPayload?.bulkBill || harmonizedPayload?.BulkBill;

                        const rawItems = bulkBill?.webguid || bulkBill?.WebGuid || bulkBill?.Webguid || [];
                        const items = rawItems.map((item) => ({
                            webGuid: item?.webguid || item?.Webguid || item?.WebGuid || item?.webGuid || "",
                            amountDue: String(item?.amountDue || item?.AmountDue || "0.00").replace(/,/g, ""),
                            creditAccount: item?.creditAccount || item?.CreditAccount || "",
                            currency: item?.currency || item?.Currency || "NGN",
                            paymentFlag: item?.paymentFlag || item?.PaymentFlag || "PartPayment",
                            cbnCode: item?.cbnCode || item?.CbnCode || "232",
                            revenueCode: item?.revenueCode || item?.RevenueCode || "",
                            revName: item?.revName || item?.RevName || "",
                            agencyCode: item?.agencyCode || item?.AgencyCode || "",
                            agencyName: item?.agencyName || item?.AgencyName || "",
                            oraAgencyRev: item?.oraAgencyRev || item?.OraAgencyRev || "",
                            acctCloseDate: item?.acctCloseDate || item?.AcctCloseDate || "",
                            readOnly: item?.readOnly || item?.ReadOnly || "No",
                            minAmount: item?.minAmount || item?.MinAmount || "0.0000",
                            maxAmount: item?.maxAmount || item?.MaxAmount || "",
                        }));

                        // TotalDue may be absent; fall back to the sum of the item amounts.
                        const itemsSum = items.reduce((sum, i) => sum + (Number.parseFloat(i.amountDue) || 0), 0);
                        const totalDue = String(bulkBill?.totalDue ?? bulkBill?.TotalDue ?? itemsSum).replace(/,/g, "");
                        const firstItem = items[0] || {};

                        const result = {
                            payerName: bulkBill?.payerName || bulkBill?.PayerName || "",
                            pid: bulkBill?.pid?.toString() || bulkBill?.Pid?.toString() || "",
                            state: bulkBill?.state || bulkBill?.State || "XXSG",
                            status: bulkBill?.status || bulkBill?.Status || "SUCCESS",
                            statusMessage: bulkBill?.statusMessage || bulkBill?.StatusMessage || "OK",
                            parentGUid: bulkBill?.parentGUid || bulkBill?.ParentGUid || "",
                            totalDue: totalDue,
                            amountDue: totalDue,
                            // Top-level fields for display/settlement fall back to the first item,
                            // since harmonized bills only carry these per-item.
                            revName: firstItem.revName || "",
                            agencyName: firstItem.agencyName || "",
                            creditAccount: firstItem.creditAccount || "",
                            cbnCode: firstItem.cbnCode || "232",
                            items: items
                        };
                        resolve(result);

                    } else if (type?.toLowerCase() === "webguid" && webGuidPayload) {
                        setTimeout(() => {
                            const selectItem = document.getElementById("selectItems");
                            if (selectItem) {
                                selectItem.style.cssText = "display: none !important;";
                            }
                        }, 10);

                        resolve({
                            webGuid: webGuidPayload?.webGuid || webGuidPayload?.WebGuid || "",
                            type: type,
                            // amountDue: webGuidPayload?.amountDue || webGuidPayload?.AmountDue || "0.00",
                            amountDue: String(webGuidPayload?.amountDue || webGuidPayload?.AmountDue || "0.00").replace(/,/g, ""),
                            status: webGuidPayload?.status || webGuidPayload?.Status || "SUCCESS",
                            creditAccount: webGuidPayload?.creditAccount || webGuidPayload?.CreditAccount || "",
                            payerName: webGuidPayload?.payerName || webGuidPayload?.PayerName || "",
                            agencyCode: webGuidPayload?.agencyCode || webGuidPayload?.AgencyCode || "",
                            revenueCode: webGuidPayload?.revenueCode || webGuidPayload?.RevenueCode || "",
                            oraAgencyRev: webGuidPayload?.oraAgencyRev || webGuidPayload?.OraAgencyRev || "",
                            state: webGuidPayload?.state || webGuidPayload?.State || "XXSG",
                            statusMessage: webGuidPayload?.statusMessage || webGuidPayload?.StatusMessage || "OK",
                            pid: webGuidPayload?.pid || webGuidPayload?.Pid || "",
                            currency: webGuidPayload?.currency || webGuidPayload?.Currency || "NGN",
                            acctCloseDate: webGuidPayload?.acctCloseDate || webGuidPayload?.AcctCloseDate || "",
                            readOnly: webGuidPayload?.readOnly || webGuidPayload?.ReadOnly || "No",
                            minAmount: webGuidPayload?.minAmount || webGuidPayload?.MinAmount || "0.0000",
                            maxAmount: webGuidPayload?.maxAmount || webGuidPayload?.MaxAmount || "",
                            paymentFlag: webGuidPayload?.paymentFlag || webGuidPayload?.PaymentFlag || "PartPayment",
                            cbnCode: webGuidPayload?.cbnCode || webGuidPayload?.CbnCode || "232",
                            agencyName: webGuidPayload?.agencyName || webGuidPayload?.AgencyName || "",
                            revName: webGuidPayload?.revName || webGuidPayload?.RevName || "",
                        });

                    } else if (topLevelStatusMessage) {
                        // Server returned a top-level message (e.g. "Reference fully paid")
                        // without a matching payload, so surface that message to the user.
                        this.hideOverlay();
                        this.showErrTypeModal(topLevelStatusMessage);
                        return;
                    } else {
                        // Safety net: neither condition matched, so reject instead of hanging
                        reject(new Error("Unexpected response format from server."));
                    }
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }
    // Initialize the payment process
    init() {
        this.injectDesignStyles()
        this.showDetailsPopup()
    }

    // Inject the shared EgolePay design system (DM Sans, navy sidebar, orange accents)
    injectDesignStyles() {
        if (document.getElementById("egp-inline-styles")) return
        const style = document.createElement("style")
        style.id = "egp-inline-styles"
        style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

/* ---- Payment popup shell (sidebar + main) ---- */
#payment-popup{background:rgba(15,23,42,.55)!important;font-family:'DM Sans',sans-serif;}
.egp-shell{background:#fff;border-radius:16px;overflow:hidden;width:100%;max-width:760px;display:flex;box-shadow:0 24px 60px rgba(0,0,0,.18);max-height:96vh;position:relative;}
.egp-sidebar{width:240px;flex-shrink:0;background:#0f172a;color:#fff;padding:28px 20px;display:flex;flex-direction:column;box-sizing:border-box;}
.egp-sidebar img{height:38px;margin-bottom:16px;object-fit:contain;align-self:flex-start;}
.egp-sb-tagline{font-size:13px;color:#94a3b8;margin:0 0 20px;}
.egp-amount-box{background:rgba(255,255,255,.07);border-radius:10px;padding:14px 16px;margin-bottom:20px;}
.egp-amount-box .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#64748b;margin-bottom:4px;}
.egp-amount-box .val{font-size:22px;font-weight:700;color:#ff8c00;}
.egp-amount-box .sub{font-size:12px;color:#64748b;margin-top:4px;}
.egp-sb-menu{display:flex;flex-direction:column;gap:6px;margin-bottom:20px;}
.egp-sb-item{padding:11px 14px;border-radius:8px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;transition:background .15s,color .15s;}
.egp-sb-item:hover{background:rgba(255,255,255,.06);color:#fff;}
.egp-sb-item.focused{background:#ff8c00;color:#fff;}
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

/* ---- Forms ---- */
.egp-title{font-size:18px;font-weight:700;color:#0f172a;margin:0 0 4px;}
.egp-subtitle{font-size:13px;color:#64748b;margin:0 0 16px;}
.egp-label{display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:5px;}
.egp-input{width:100%;padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;transition:border .15s,box-shadow .15s;box-sizing:border-box;margin-bottom:13px;color:#0f172a;background:#fff;}
.egp-input:focus{border-color:#ff8c00;box-shadow:0 0 0 3px rgba(255,140,0,.1);}
.egp-input.error{border-color:#dc2626;background:#fef2f2;}
.egp-input.readonly{font-weight:700;color:#ff8c00;background:#fff7ed;border-color:#fed7aa;}
.egp-input.pin-mask{-webkit-text-security:disc;text-security:disc;}
.egp-error-text{display:block;color:#dc2626;font-size:12px;margin:-8px 0 10px;min-height:14px;font-weight:500;}
.egp-row{display:flex;gap:10px;}
.egp-row>div{flex:1;min-width:0;}
.egp-btn{display:block;width:100%;margin:0;padding:10px 16px;border:1px solid transparent;border-radius:3px;font-size:14px;line-height:1.42857;font-weight:600;text-align:center;white-space:nowrap;vertical-align:middle;cursor:pointer;font-family:'DM Sans',sans-serif;-webkit-user-select:none;user-select:none;box-sizing:border-box;-webkit-transition:background-color .15s ease-in-out,border-color .15s ease-in-out;transition:background-color .15s ease-in-out,border-color .15s ease-in-out;}
.egp-btn:focus{outline:thin dotted;outline:5px auto -webkit-focus-ring-color;outline-offset:-2px;}
.egp-btn:active{-webkit-box-shadow:inset 0 3px 5px rgba(0,0,0,.125);box-shadow:inset 0 3px 5px rgba(0,0,0,.125);}
.egp-btn-primary{background-color:#ff8c00;border-color:#e07d00;color:#fff;}
.egp-btn-primary:hover{background-color:#e67e00;border-color:#c46c00;}
.egp-btn-secondary{background-color:#fff;border-color:#ccc;color:#333;margin-top:8px;}
.egp-btn-secondary:hover{background-color:#e6e6e6;border-color:#adadad;}
.egp-btn-green{background-color:#5cb85c;border-color:#4cae4c;color:#fff;}
.egp-btn-green:hover{background-color:#449d44;border-color:#398439;}
.egp-card-icons{display:flex;gap:8px;margin-bottom:16px;}
.egp-card-icons img{height:26px;opacity:.85;}
.egp-secure-note{font-size:11px;color:#94a3b8;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;}

/* ---- Bank / transfer boxes ---- */
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

/* ---- Generic centered modal (bill / otp / success / error) ---- */
.egp-center-modal{font-family:'DM Sans',sans-serif;background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.18);color:#0f172a;box-sizing:border-box;}
.egp-modal-logo{text-align:center;margin-bottom:18px;}
.egp-modal-logo img{height:34px;object-fit:contain;max-width:180px;}
.egp-modal-title{font-size:18px;font-weight:700;color:#0f172a;margin:0 0 16px;text-align:center;}
.egp-info-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:10px;}
.egp-info-box .lbl,.egp-info-box label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin:0 0 4px;display:block;font-weight:600;}
.egp-info-box .value-display{font-size:15px;font-weight:600;color:#0f172a;display:block;word-break:break-word;}
.egp-item-list{list-style:none;padding:0;margin:6px 0 0;}
.egp-item-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eef2f7;gap:12px;}
.egp-item-row:last-child{border-bottom:none;}
.egp-item-row .item-name{font-size:13px;color:#475569;}
.egp-item-row .item-price{font-size:14px;font-weight:700;color:#ff8c00;white-space:nowrap;}
.egp-checkbox-label{display:flex;align-items:center;gap:10px;font-size:14px;color:#0f172a;font-weight:500;padding:4px 0;}
.egp-checkbox-label input{accent-color:#ff8c00;width:16px;height:16px;}

/* ---- Success ---- */
.egp-success-icon{width:56px;height:56px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:26px;color:#fff;}

/* ---- OTP ---- */
.egp-otp-input{text-align:center;font-size:22px;letter-spacing:8px;}

/* ---- Spinner / loading ---- */
.egp-spinner-lg{width:38px;height:38px;border:4px solid #f1f5f9;border-top-color:#ff8c00;border-radius:50%;animation:egpSpin .8s linear infinite;margin:0 auto 12px;}
@keyframes egpSpin{to{transform:rotate(360deg)}}

/* ---- Close button ---- */
.egp-close{position:absolute;top:10px;right:14px;width:auto;height:auto;margin:0;padding:0 4px;display:block;background:none;border:0;border-radius:0;font-size:24px;font-weight:700;line-height:1;color:#000;opacity:.4;cursor:pointer;font-family:Arial,Helvetica,sans-serif;z-index:3;-webkit-transition:opacity .15s ease-in-out;transition:opacity .15s ease-in-out;}
.egp-close:hover,.egp-close:focus{opacity:.75;outline:none;}



/* ---- Responsive ---- */
@media(max-width:640px){
  .egp-shell{flex-direction:column;max-height:100vh;height:100%;border-radius:0;}
  .egp-sidebar{width:100%;flex-direction:row;flex-wrap:wrap;align-items:center;padding:16px 20px;}
  .egp-sidebar img{margin-bottom:0;max-width:38%;height:auto;}
  .egp-sb-secure,.egp-sb-tagline{display:none;}
  .egp-sb-menu{flex-direction:row;flex-wrap:wrap;width:100%;margin:12px 0 0;gap:6px;}
  .egp-sb-item{flex:1 1 45%;text-align:center;}
  .egp-amount-box{margin-bottom:0;margin-left:auto;padding:10px 14px;max-width:58%;}
  .egp-amount-box .val{font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  #payment-popup{padding:0!important;}
  .egp-row{flex-direction:column;gap:0;}
}
`
        document.head.appendChild(style)
    }

    // Show the payment details popup
    showDetailsPopup() {
        if (document.getElementById("payment-overlay")) {
            return
        }
        const overlay = this.createOverlay()
        document.body.appendChild(overlay)
        this.getBillConfirmationPopup()
    }

    // Redirect to home page
    redirectToHome() {
        window.location.href = "https://www.egolepay.com"
    }

    // Check if agency has special service fee
    hasSpecialServiceFee(agencyName) {
        return agencyName === "Lagos State Safety Commission"
    }

    // Get special service fee amount
    getSpecialServiceFee(agencyName) {
        return this.hasSpecialServiceFee(agencyName) ? 0 : 0
    }

    // In showDetailsPopup()
    showDetailsPopup() {
        // Check if any payment popup already exists
        if (document.querySelector("#payment-overlay, .payment-popup, #confirmbill-popup")) {
            return;
        }
        const overlay = this.createOverlay();
        document.body.appendChild(overlay);
        this.getBillConfirmationPopup();
    }

    isMandatoryItem(itemName, type) {
        if (type.toLowerCase() !== "harmonized") {
            return false;
        }

        const mandatoryItems = ["drivers license registration", "driver license registration", "drivers licence registration", "driver licence registration"];

        return mandatoryItems.some(mandatory => itemName.toLowerCase().includes(mandatory));
    }

    // Normalised bill type, sent to the payment APIs as `guidType` (WebguidType).
    getGuidType() {
        const { type } = this.getQueryParams()

        return (type || "").toLowerCase() === "webguid" ? "webguid" : "harmonized"
    }

    // `allIsSelected` is true for webguid bills (a single bill has nothing to
    // deselect) and, for harmonized bills, only when every item on the bill is
    // still ticked. Anything narrower is a partial payment.
    isAllItemsSelected() {
        if (this.getGuidType() === "webguid") {
            return true
        }

        const total = Number(this.totalBillItemCount) || 0
        const selected = this.selectedItemsData?.length || 0

        return total > 0 && selected >= total
    }

    // `ParentGUID` is the original reference the checkout was opened with: the
    // parent bill for a harmonized set, the bill itself for a webguid. It stays
    // fixed even when a narrowed selection means a child webGuid is what gets
    // paid, so the engine can still tie the payment back to the whole bill.
    getParentGuid() {
        const { webGuid } = this.getQueryParams()

        return this.parentGuid || webGuid || ""
    }

    getBillConfirmationPopup() {
        // Prevent duplicate popups
        if (document.getElementById("confirmbill-popup")) {
            return;
        }
        this.showOverlay("Processing, please wait...")
        const { webGuid, type } = this.getQueryParams()

        // Fetch bill details and create popup
        this.updateStep("bill_verification", { webGuid, type });
        this.verifyBill(webGuid, type)
            .then((response) => {
                const payerName = response.payerName || ""
                const pid = response.pid || ""
                // const amountDue = response.totalDue ?? response.amountDue ?? 0
                const amountDue = String(response.totalDue ?? response.amountDue ?? 0).replace(/,/g, "")
                const revName = response.revName || "NaN"
                const agencyName = response.agencyName || "NaN"
                const creditAccount = response.creditAccount || ""
                const cbnCode = response.cbnCode || ""
                const items = response.items || []

                const serviceFee = this.calculateServiceFee(amountDue)
                //console.log("serviceFee " + serviceFee)
                const totalAmount = this.calculateTotalAmount(amountDue, serviceFee, agencyName)
                //console.log("totalAmount serviceFee " + totalAmount)

                //  Build items list HTML. Harmonized bills get per-item checkboxes so the
                //  payer can pay a subset; every other type stays a read-only list.
                const isHarmonizedType = type?.toLowerCase() === "harmonized"
                let itemsListHTML = '';
                if (items && items.length > 0) {
                    itemsListHTML = items.map((item, index) => {
                        const price = `\u20A6${Number.parseFloat(item.amountDue).toLocaleString()}`

                        if (!isHarmonizedType) {
                            return `
                    <li class="item-list-entry">
                        <span class="item-name">${item.revName}</span>
                        <span class="item-price">${price}</span>
                    </li>
                `
                        }

                        // Mandatory items stay checked and cannot be unticked.
                        const mandatory = this.isMandatoryItem(item.revName || "", type)

                        return `
                    <li class="item-list-entry">
                        <label class="egp-checkbox-label">
                            <input type="checkbox" class="egp-item-check" data-index="${index}" checked ${mandatory ? "disabled" : ""} />
                            <span class="item-name">${item.revName}</span>
                        </label>
                        <span class="item-price">${price}</span>
                    </li>
                `
                    }).join('');
                }

                // Create popup element
                const popup = document.createElement("div")
                popup.id = "confirmbill-popup"
                popup.classList.add("payment-popup")
                popup.classList.add("egp-center-modal")

                popup.style.zIndex = "1001"
                popup.style.backgroundColor = "#ffffff"
                popup.style.fontFamily = "'DM Sans', sans-serif"
                popup.style.overflowX = "hidden"
                popup.style.position = "fixed"
                popup.style.top = "50%"
                popup.style.left = "50%"
                popup.style.transform = "translate(-50%, -50%)"
                popup.style.width = "90%"
                popup.style.maxWidth = "460px"
                popup.style.padding = "24px"
                popup.style.borderRadius = "16px"
                popup.style.boxShadow = "0 24px 60px rgba(0, 0, 0, 0.18)"
                popup.style.maxHeight = "92vh"

                // Add mobile styles
                const mobileStyles = document.createElement("style")
                mobileStyles.textContent = `
@media (max-width: 576px) {
    .payment-popup {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100% !important;
        max-height: 100% !important;
        transform: none !important;
        border-radius: 0 !important;
        padding: 16px !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        box-sizing: border-box !important;
    }

    .popup-body {
        max-height: calc(100vh - 200px) !important;
        margin: 16px 0 !important;
        padding: 0 12px !important;
        overflow-x: hidden !important;
        box-sizing: border-box !important;
    }

    #popupfooter {
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        width: 100% !important;
        background: white !important;
        padding: 12px 16px !important;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.1) !important;
        display: flex !important;
        gap: 12px !important;
        z-index: 1002 !important;
        box-sizing: border-box !important;
    }

    button {
        font-size: 16px !important;
        padding: 12px !important;
    }

    .container {
        padding: 12px !important;
        margin-bottom: 12px !important;
        box-sizing: border-box !important;
    }

    .popup-header img {
        max-width: 200px !important;
    }
}

/*  Styles for item list (no checkboxes) */
.item-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.item-list-entry {

    justify-content: space-between;
    padding: 8px 0;
    position: relative;
}

.item-list-entry:not(:last-child)::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 15%;
    right: 15%;
    width: 70%;
    height: 1px;
    background-color: #dddd;
}

.item-name {
    font-size: 14px;
    color: #333;
    flex: 1;
}

.item-price {
    font-size: 14px;
    font-weight: bold;
    color: orange;
    white-space: nowrap;
    margin-left: 12px;
}
`

                document.head.appendChild(mobileStyles)

                // Populate popup with HTML content
                popup.innerHTML = `
        <div class="egp-modal-logo"><img src="${this.companyLogo}" alt="EgolePay" /></div>
        <div class="popup-body">
            <style>
                #confirmbill-popup .popup-body{max-height:60vh;overflow-y:auto;margin:0 0 4px;padding-right:4px;}
                #confirmbill-popup .item-list{list-style:none;padding:0;margin:6px 0 0;}
                #confirmbill-popup .item-list-entry{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eef2f7;gap:12px;}
                #confirmbill-popup .item-list-entry:last-child{border-bottom:none;}
                #confirmbill-popup .item-name{font-size:13px;color:#475569;}
                #confirmbill-popup .item-price{font-size:14px;font-weight:700;color:#ff8c00;white-space:nowrap;}
                #confirmbill-popup .egp-checkbox-label{display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:0;}
                #confirmbill-popup .egp-checkbox-label input{accent-color:#ff8c00;width:16px;height:16px;flex-shrink:0;cursor:pointer;}
                #confirmbill-popup .egp-checkbox-label input:disabled{cursor:not-allowed;opacity:0.65;}
                #confirmbill-popup .egp-checkbox-label input:disabled ~ .item-name{color:#94a3b8;}
                #confirmbill-popup .egp-fee-note{margin:6px 0 0;font-size:11.5px;line-height:1.45;color:#64748b;}
            </style>
<meta name="viewport" content="width=device-width, initial-scale=0.7">

            <h4 class="egp-modal-title" style="text-align:left;font-size:17px;">Confirm Bill Information</h4>

            <div class="egp-info-box">
                <label for="payerName">Payer Name</label>
                <span class="value-display" id="payer-name">${payerName}</span>
            </div>

            <div class="egp-info-box">
                <label for="pid">PID</label>
                <span class="value-display" id="pid">${pid}</span>
            </div>

            <div class="egp-info-box" id="RevenueCodeDiv">
                <label for="revenueCode">Revenue</label>
                <span class="value-display" id="revenue-code">${revName}</span>
            </div>

            <div class="egp-info-box" id="AgencyCodeDiv">
                <label for="agencyCode">Agency</label>
                <span class="value-display" id="agency-code">${agencyName}</span>
            </div>

            ${items && items.length > 0 ? `
            <div class="egp-info-box" id="itemsList">
                <label>Bill Items</label>
                <ul class="item-list" id="items-display">
                    ${itemsListHTML}
                </ul>
            </div>
            ` : ''}

            <div class="egp-info-box" id="processingFeeBox">
                <label>Processing Fee </label>
                <ul class="item-list" id="service-fee-display">
                    ₦${Number.parseFloat(serviceFee).toLocaleString()}
                </ul>
                <p class="egp-fee-note">A 1% processing fee is added to your payment, never less than ₦100 and never more than ₦1,200.</p>
            </div>

            <div class="egp-info-box" style="background:#fff7ed;border-color:#fed7aa;">
                <label for="amountDue" style="color:#c2620a;">Amount Due to Pay</label>
                <span class="value-display" id="amount-due" style="color:#ff8c00;font-size:20px;">\u20A6${Number.parseFloat(totalAmount).toLocaleString()}</span>
            </div>

          <div class="egp-info-box"  style="display: none">
                <label for="amount-to-pay">Amount to Pay</label>
                <input class="egp-input" style="margin-bottom:0;" type="text" id="amount-to-pay" name="amount-to-pay" value="${amountDue}" />
            </div>

            <div class="egp-info-box" style="display: none">
                <label for="total-amount">Total Amount</label>
                <span class="value-display" id="total-amount">\u20A6${totalAmount}</span>
            </div>
        </div>

        <div id="popupfooter" style="margin-top: 16px; display: flex; gap: 10px;">
            <button id="confirmpayment" class="egp-btn egp-btn-primary">Confirm Pay</button>
            <button id="cancel-confirmpayment" class="egp-btn egp-btn-secondary" style="margin-top:0;">Cancel</button>
        </div>
    `
                // Close button
                const closeBtn = document.createElement("button");
                closeBtn.innerHTML = "&times;";
                closeBtn.className = "egp-close";
                closeBtn.setAttribute("aria-label", "Close");

                closeBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.handleClose("USER_CLOSED_X_BUTTON");
                });

                popup.appendChild(closeBtn);

                const cancelButton = popup.querySelector("#cancel-confirmpayment")
                cancelButton.addEventListener("click", () => {
                    this.removePopup("confirmbill-popup");
                    this.handleClose("USER_CANCELLED_BILL_CONFIRMATION");
                });

                document.body.appendChild(popup)

                this.selectedItemsData = items;
                this.selectedAddonCount = items.length;
                // The response knows the real parent; the URL ref may be a child.
                this.parentGuid = response.parentGUid || webGuid;
                // Full size of the bill, so `allIsSelected` can tell a complete
                // payment from a partial one after the payer unticks something.
                this.totalBillItemCount = items.length;

                // Handle amount input changes
                const amountToPayInput = document.getElementById("amount-to-pay")
                // NOTE: there is no #service-fee element in this popup; the visible fee
                // lives in #service-fee-display. Every write below is guarded because
                // these lookups can legitimately miss.
                const serviceFeeLabel = document.getElementById("service-fee")
                const totalAmountLabel = document.getElementById("total-amount")
                const confirmPaymentButton = document.getElementById("confirmpayment")
                const amountDueDisplay = popup.querySelector("#amount-due")
                const serviceFeeDisplay = popup.querySelector("#service-fee-display")

                // Which items the payer has ticked. Non-harmonized bills have no
                // checkboxes, so the whole list is always in play.
                const getSelectedItems = () => {
                    if (!isHarmonizedType || !items.length) {
                        return items
                    }

                    const boxes = popup.querySelectorAll(".egp-item-check")
                    if (!boxes.length) {
                        return items
                    }

                    return Array.from(boxes)
                        .filter((box) => box.checked)
                        .map((box) => items[Number.parseInt(box.dataset.index, 10)])
                        .filter(Boolean)
                }

                const sumAmountDue = (list) => list.reduce((sum, item) => sum + (Number.parseFloat(String(item.amountDue).replace(/,/g, "")) || 0), 0)

                // Recompute fee + total from the current selection and repaint the modal.
                const recalculateFromSelection = () => {
                    const selected = getSelectedItems()
                    const subtotal = isHarmonizedType ? sumAmountDue(selected) : Number.parseFloat(amountDue)

                    // calculateServiceFee floors at ₦100, so an empty selection would
                    // otherwise render as ₦100 due. Show a true zero instead.
                    const fee = subtotal > 0 ? this.calculateServiceFee(subtotal) : "0.00"
                    const total = subtotal > 0 ? this.calculateTotalAmount(subtotal, fee, agencyName) : "0.00"

                    if (amountToPayInput) {
                        amountToPayInput.value = subtotal
                    }

                    if (serviceFeeLabel) {
                        serviceFeeLabel.textContent = `₦${fee}`
                    }

                    if (totalAmountLabel) {
                        totalAmountLabel.textContent = `₦${total}`
                    }

                    if (serviceFeeDisplay) {
                        serviceFeeDisplay.textContent = `₦${Number.parseFloat(fee).toLocaleString()}`
                    }

                    if (amountDueDisplay) {
                        amountDueDisplay.textContent = `₦${Number.parseFloat(total).toLocaleString()}`
                    }

                    const nothingSelected = selected.length === 0
                    confirmPaymentButton.disabled = nothingSelected
                    confirmPaymentButton.style.opacity = nothingSelected ? "0.6" : ""
                    confirmPaymentButton.style.cursor = nothingSelected ? "not-allowed" : "pointer"
                }

                if (isHarmonizedType) {
                    popup.querySelectorAll(".egp-item-check").forEach((box) => {
                        box.addEventListener("change", recalculateFromSelection)
                    })
                    recalculateFromSelection()
                }

                amountToPayInput.addEventListener("input", () => {
                    let amountToPay = Number.parseFloat(amountToPayInput.value.replace(",", "")) || 0
                    const amountDueValue = Number.parseFloat(amountDue)

                    if (amountToPay === 0) {
                        amountToPay = amountDueValue
                    }

                    const serviceFee = this.calculateServiceFee(amountToPay)
                    const totalAmount = this.calculateTotalAmount(amountToPay, serviceFee, agencyName)

                    if (serviceFeeLabel) {
                        serviceFeeLabel.textContent = `\u20A6${serviceFee}`
                    }

                    if (totalAmountLabel) {
                        totalAmountLabel.textContent = `\u20A6${totalAmount}`
                    }
                })

                // Handle confirm payment button click
                confirmPaymentButton.addEventListener("click", () => {
                    const selectedItems = getSelectedItems()

                    if (isHarmonizedType && selectedItems.length === 0) {
                        this.showErrorModal("Please select at least one bill item to pay.")
                        return
                    }

                    const amountToPay = Number.parseFloat(String(amountToPayInput.value).replace(/,/g, "")) || 0

                    // Validate minimum amount
                    if (amountToPay < 100) {
                        this.showErrorModal("Amount to pay cannot be less than \u20A6100. Please enter a valid amount.")
                        return
                    }

                    // Validate maximum amount
                    const amountDueValue = Number.parseFloat(amountDue)

                    if (amountToPay > amountDueValue) {
                        this.showErrorModal(`Amount to pay cannot be more than \u20A6${amountDueValue.toFixed(2)}`)
                        return
                    }

                    const serviceFee = this.calculateServiceFee(amountToPay)
                    const totalAmount = this.calculateTotalAmount(amountToPay, serviceFee, agencyName)

                    // Prepare payment - use parentGuid for harmonized, webGuid for single
                    let webGuidToSend;

                    if (isHarmonizedType) {
                        // Flatten single-item harmonized bills: the parent GUID is not a
                        // valid payable reference on its own, so a lone child item must be
                        // paid using its own webGuid (otherwise "Reference validation failed").
                        // This applies equally when the payer ticks only one of several items.
                        if (selectedItems.length === 1) {
                            webGuidToSend = selectedItems[0].webGuid || response.parentGUid || webGuid;
                            this.selectedItemsData = [selectedItems[0]];
                        } else {
                            webGuidToSend = response.parentGUid || webGuid;
                            this.selectedItemsData = selectedItems;
                        }
                        this.selectedAddonCount = this.selectedItemsData.length;
                    } else {
                        webGuidToSend = webGuid;
                        this.selectedItemsData = [response];
                    }

                    // Downstream screens should reflect what is actually being paid, not the
                    // full harmonized bill, whenever the payer narrowed the selection.
                    const effectiveAmountDue = isHarmonizedType ? amountToPay : amountDueValue

                    // Validations have passed and we are about to hit the network.
                    this.setButtonBusy(confirmPaymentButton, "Processing...")

                    // Process payment
                    this.handlePaymentConfirmation(webGuidToSend, pid, totalAmount, payerName, creditAccount, cbnCode, this.removeCommas(amountToPay), this.removeCommas(effectiveAmountDue), revName, agencyName)
                })

                // Add cancel button event listener
                document.getElementById("cancel-confirmpayment").addEventListener("click", () => this.handleCancel())

                this.hideOverlay()
            })
            .catch((error) => {
                this.hideOverlay()
                this.showErrModal(error.message || "Failed to retrieve bill information. Please try again.")
            })
    }   // Remove commas from amount string

    removeCommas(amount) {
        return Number.parseFloat(String(amount).replace(/,/g, ""))
    }

    // Convert string to number, handling edge cases
    convertToNumber(amount) {
        if (amount === undefined || amount === null) {
            return null
        }

        const numericValue = Number.parseFloat(amount.toString().replace(/,/g, ""))

        if (isNaN(numericValue)) {
            return null
        }

        return numericValue
    }

    // Check if agency has special service fee
    hasProviderSpecialServiceFee(providerID) {
        return providerID === "22C811B4-EF62-48DA-8F35-E714F3992BC4";
    }

    // Get special service fee amount
    getProviderSpecialServiceFee(providerID) {
        return this.hasProviderSpecialServiceFee(providerID) ? 200 : 0;
    }

    // Calculate service fee based on amount
    calculateServiceFee(amountToPay) {
        const amount = this.convertToNumber(amountToPay);

        if (amount === null || isNaN(amount)) {
            return 0;
        }

        // Service fee: 1% of the amount, floored at 100 and capped at 1200.
        let serviceFee = amount * 0.01;
        serviceFee = Math.max(serviceFee, 100);  // Minimum fee of 100
        serviceFee = Math.min(serviceFee, 1200); // Maximum fee of 1200

        return serviceFee.toFixed(2);
    }

    // Calculate total amount including fees
    // calculateTotalAmount(amountToPay, fee, agencyName = "") {
    calculateTotalAmount(amountToPay, fee, agencyName = "") {
        const amount = this.convertToNumber(amountToPay);
        if (amount === null) return;

        const serviceFee = this.hasSpecialServiceFee(agencyName)
            ? 0
            : Number.parseFloat(fee || 0);

        const totalAmount = Number.parseFloat(amount) + serviceFee;

        //console.log("Amount:", amount);
        //console.log("Service Fee:", serviceFee);
        //console.log("Total Amount:", totalAmount);

        return totalAmount.toFixed(2);
    }
    //calculateTotalAmount(amountToPay, agencyName = "") {
    //    const amount = this.convertToNumber(amountToPay)
    //    if (amount === null) return

    //    // Add special service fee if applicable
    //    const specialServiceFee = this.hasSpecialServiceFee(agencyName) ? 0 : 0
    //    // const totalAmount = Number.parseFloat(amount) + Number.parseFloat(fee) + specialServiceFee
    //    const totalAmount = Number.parseFloat(amount) + specialServiceFee
    //    //console.log("totalAmount " + totalAmount)
    //    //console.log("specialServiceFee " + specialServiceFee)
    //    return totalAmount.toFixed(2)
    //}

    // Create overlay element
    createOverlay() {
        const overlay = document.createElement("div")
        overlay.id = "payment-overlay"
        overlay.style.position = "fixed"
        overlay.style.top = "0"
        overlay.style.left = "0"
        overlay.style.width = "100%"
        overlay.style.height = "100%"
        overlay.style.backgroundColor = "rgba(15, 23, 42, 0.55)"
        overlay.style.zIndex = "1000"
        overlay.style.padding = "5px"

        return overlay
    }

    // Handle payment confirmation
    handlePaymentConfirmation(webGuid, pid, amount, payerName, creditAccount, cbnCode, amountToPay, amountDue, revName, agencyName,) {
        this.processTransaction(webGuid, pid, amount, payerName, creditAccount, cbnCode, amountToPay, amountDue, revName, agencyName,)
    }

    // process transaction.
    async processTransaction(webGuid, pid, amount, payerName, creditAccount, cbnCode, amountToPay, amountDue, revName, agencyName, selectedGuids, type = "", parsedDataValues = {},) {
        this.removePopup("confirmbill-popup")
        this.removePopup("error-modal")
        this.showOverlay("Processing, please wait...")

        const tnxMainRef = webGuid === "harmonized" ? "" : webGuid

        // Everything the e-Receipt needs later, captured once here. `amount`
        // is the total the payer is charged (service fee included).
        this._receiptCtx = {
            total: this.convertToNumber(amount) || this.convertToNumber(amountToPay) || 0,
            payerName: payerName || "",
            agencyName: agencyName || "",
            revName: revName || "",
            webGuid, pid,
        }

        const requestPayload = {
            amount: amountToPay, apiKey: this.apiKey,//"QXZbHtF6m_oed1QFPAAAY4jFGP3-jyM-wjhgfdf87655678",
            tnxMainRef, pid, transactions: [],
        }

        requestPayload.transactions = this.selectedItemsData.map((item) => {
            let itemTxnRef = item.webGuid
            if (type.toLowerCase() === "webguid" && (!itemTxnRef || itemTxnRef === "")) {
                itemTxnRef = webGuid
            }

            return {
                amount: this.selectedItemsData?.length > 1 ? +item.amountDue : +amountToPay,
                apiKey: this.apiKey,//"QXZbHtF6m_oed1QFPAAAY4jFGP3-jyM-wjhgfdf87655678",
                webGuid: itemTxnRef || webGuid,
                settlementBank: this.getBankName(cbnCode),
                settlementAccount: item.creditAccount,
                settlementCode: item.cbnCode,
                agencyName: item.agencyName,
                agencyCode: item.agencyName,
                txnRef: pid,
                revenueName: item.revName,
                payerName: item.payerName,
                payerEmail: parsedDataValues.email,
            }
        })

        fetch(this.transactionEndpoint, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestPayload),
        })
            .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
            .then(({ ok, data }) => {
                this.hideOverlay()

                // Handle validation/error responses e.g. { "message": "...", "details": "..." }
                if (!ok || data.message || (data.errors && data.errors.length > 0)) {
                    const errorMessage = data.message
                        || (data.errors && data.errors.length > 0 && data.errors[0].message)
                        || "Unable to process payment at the moment. Please try again."
                    const details = data.details ? `<br><span style="font-size:12px;color:#888;">${data.details}</span>` : ""
                    this.showErrorModal(`${errorMessage}`)
                    return
                }

                const transactions = data.transactions || []

                //  Save all transRefs to this.harmonizeRefs
                this.harmonizeRefs = transactions.map((tx) => tx.TransRef)

                // Save the first harmonizeRef and transRef separately for default usage
                const firstTransaction = transactions[0] || {}
                this.harmonizeRef = firstTransaction.harmonizeRef
                this.transRef = firstTransaction.TransRef

                this.showPopup(webGuid, pid, amount, payerName, creditAccount, cbnCode, amountToPay, amountDue, revName, agencyName, firstTransaction.txnRef, firstTransaction.harmonizeRef,)
            })
            .catch((error) => {
                this.hideOverlay()
                this.showErrorModal(error?.message || "Unable to process payment at the moment. Please try again.")
            })
    }

    // Handle payment cancellation.
    // The SDK owns the button UI and teardown; the merchant owns the reaction
    // via the onCancel callback. We do NOT redirect or reload here, that is the
    // merchant's decision (redirect, restore cart, log, notify, etc.).
    handleCancel(reason = "USER_CANCELLED") {
        const step = this.currentStep;

        // Tear down every overlay the SDK owns + detach global listeners
        this._teardown();

        // Notify merchant
        if (typeof this.onCancel === "function") {
            this.onCancel({ status: "cancelled", reason, step });
        }
    }

    // Remove every popup/overlay the SDK owns and detach global listeners.
    _teardown() {
        const popupsToRemove = [
            "payment-popup", "otp-popup", "payment-overlay", "confirmbill-popup",
            "bill-validation-popup", "payment-options-popup", "error-modal",
            "success-popup", "amterror-modal", "processing-overlay"
        ];
        popupsToRemove.forEach(popupId => this.removePopup(popupId));
        document.querySelectorAll('.payment-popup').forEach(popup => popup.remove());
        this._removeResultModal();
        this._releaseReceiptResources();
        document.removeEventListener('keydown', this.handleEscKey);
    }

    // Handle close action (full exit)
    handleClose_(reason = "USER_CLOSED") {
        // Clean up SDK UI
        this.removePopup("payment-popup");
        this.removePopup("otp-popup");
        this.removePopup("payment-overlay");
        this.removePopup("confirmbill-popup");
        this.removePopup("bill-validation-popup");
        this.removePopup("payment-options-popup");

        // Notify merchant via onClose callback
        if (typeof this.onClose === "function") {
            this.onClose({
                status: "closed", reason: reason, step: this.currentStep || "unknown"
            });
        }
    }

    handleClose(reason = "USER_CLOSED") {
        // Clean up ALL popups
        const popupsToRemove = ["payment-popup", "otp-popup", "payment-overlay", "confirmbill-popup", "bill-validation-popup", "payment-options-popup", "error-modal", "success-popup", "amterror-modal", "processing-overlay"];

        popupsToRemove.forEach(popupId => this.removePopup(popupId));

        // Remove all popup elements by class as well
        document.querySelectorAll('.payment-popup').forEach(popup => popup.remove());

        // Walking away mid-flow (X button, ESC, or the Cancel control) is a
        // cancellation from the merchant's point of view, so give them the same
        // onCancel hook the Cancel button fires. A close that follows a completed
        // payment is not a cancellation.
        const isSuccessfulExit = reason === "PAYMENT_SUCCESSFUL";

        if (!isSuccessfulExit && typeof this.onCancel === "function") {
            this.onCancel({
                status: "cancelled", reason: reason, step: this.currentStep || "unknown"
            });
        }

        // Notify merchant via onClose callback
        if (typeof this.onClose === "function") {
            this.onClose({
                status: "closed", reason: reason, step: this.currentStep || "unknown"
            });
        }

        // Remove ESC key listener if this is final close
        if (reason === "USER_CLOSED" || reason === "KEYBOARD_ESC") {
            document.removeEventListener('keydown', this.handleEscKey);
        }
    }

    handleStepCancel(stepName) {
        // Remove specific popup for this step
        if (stepName === "payment_options") {
            this.removePopup("payment-options-popup");
        } else if (stepName === "card_payment") {
            this.removePopup("payment-popup");
        } else if (stepName === "bill_confirmation") {
            this.removePopup("confirmbill-popup");
        }

        // Notify merchant
        this.onCancel?.({
            status: "step_cancelled", reason: "USER_CANCELLED_STEP", step: stepName
        });
    }

    // Update step and notify merchant
    updateStep(stepName, stepData = {}) {
        const previousStep = this.currentStep;
        this.currentStep = stepName;

        if (typeof this.onStepChange === "function") {
            this.onStepChange({
                previousStep: previousStep, currentStep: stepName, timestamp: new Date().toISOString(), data: stepData
            });
        }
    }

    // Remove popup by ID
    removePopup(popupId) {
        // querySelectorAll, not getElementById: a duplicate id is invalid HTML but
        // it does happen, and removing only the first leaves the second on screen.
        document.querySelectorAll(`#${popupId}`).forEach((popup) => popup.remove())
    }

    showPopup(webGuid, pid, amount, payerName, creditAccount, cbnCode, amountToPay, amountDue, revName, agencyName, transRef) {
        this.updateStep("payment_options", {
            amount, paymentMethods: ["card", "transfer"]
        });
        this.removePopup("confirmbill-popup")
        this.removePopup("error-modal")

        const popup = this.createPaymentOptionPopup(amount)
        document.body.appendChild(popup)

        // Get references to menu items AFTER popup is added to DOM
        const transferItem = document.getElementById("paytransfer");
        const cardItem = document.getElementById("card");
        const walletItem = document.getElementById("wallet");
        const fundaccountItem = document.getElementById("fundaccount");
        const posItem = document.getElementById("pos");

        const showComingSoon = (activeItem) => {
            // Reset focus
            [transferItem, cardItem, walletItem, fundaccountItem, posItem]
                .forEach(item => item.classList.remove("focused"));

            activeItem.classList.add("focused");

            document.getElementById("payment-form").innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <h4 style="font-weight: bold; margin-bottom: 15px; color: #333; font-size: 24px;">Coming Soon</h4>
            <button id="back-to-transfer" style="
                background-color: orange;
                color: white;
                border: none;
                padding: 12px 30px;
                font-size: 14px;
                border-radius: 6px;
                cursor: pointer;
            ">Go Back to Transfer Payment</button>
        </div>
        `;

            setTimeout(() => {
                const backBtn = document.getElementById("back-to-transfer");
                if (backBtn) {
                    backBtn.addEventListener("click", () => {
                        [transferItem, cardItem, walletItem, fundaccountItem, posItem]
                            .forEach(item => item.classList.remove("focused"));
                        transferItem.classList.add("focused");
                        this.showTransferForm(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef);
                    });
                }
            }, 0);
        };

        // Add event listeners for payment method switching
        transferItem.addEventListener("click", () => {
            [transferItem, cardItem, walletItem, fundaccountItem, posItem]
                .forEach(item => item.classList.remove("focused"));
            transferItem.classList.add("focused");
            this.showTransferForm(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef);
        });

        cardItem.addEventListener("click", () => {
            [transferItem, cardItem, walletItem, fundaccountItem, posItem]
                .forEach(item => item.classList.remove("focused"));
            cardItem.classList.add("focused");
            this.showCardPaymentForm(webGuid, pid, amount, payerName, creditAccount, cbnCode, amountDue, revName, agencyName, transRef);
        });

        walletItem.addEventListener("click", () => {
            [transferItem, cardItem, walletItem, fundaccountItem, posItem]
                .forEach(item => item.classList.remove("focused"));
            walletItem.classList.add("focused");
            this.showPayWithWalletForm(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef);
        });

        fundaccountItem.addEventListener("click", () => {
            [transferItem, cardItem, walletItem, fundaccountItem, posItem]
                .forEach(item => item.classList.remove("focused"));
            fundaccountItem.classList.add("focused");  // ✅ CORRECT - highlights fund account menu
            this.showFundWalletForm(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef);
        });

        posItem.addEventListener("click", () => {
            showComingSoon(posItem);
        });

        // Automatically load transfer form after popup is ready
        setTimeout(() => {
            this.showTransferForm(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef);
        }, 100);

        // Handle pay-now and cancel buttons (these will be added by the form)
        const addPaymentListeners = () => {
            const payNowBtn = document.getElementById("pay-now");
            const cancelBtn = document.getElementById("cancel-payment");

            if (payNowBtn) {
                payNowBtn.addEventListener("click", () => this.handlePaymentSubmission(webGuid, pid, amount, payerName, creditAccount, cbnCode, amountDue, revName, agencyName, transRef));
            }

            if (cancelBtn) {
                cancelBtn.addEventListener("click", () => {
                    this.removePopup("payment-popup");
                    this.getBillConfirmationPopup();
                });
            }
        };

        // Try to add listeners after a short delay to ensure form is loaded
        setTimeout(addPaymentListeners, 200);
    }

    createPaymentOptionPopup(amount) {
        const popup = document.createElement("div")
        popup.id = "payment-popup"
        popup.style.position = "fixed"
        popup.style.top = "0"
        popup.style.left = "0"
        popup.style.width = "100%"
        popup.style.height = "100%"
        popup.style.backgroundColor = "rgba(0, 0, 0, 0.5)"
        popup.style.display = "flex"
        popup.style.justifyContent = "center"
        popup.style.alignItems = "center"
        popup.style.zIndex = "1001"
        popup.style.padding = "10px"

        const content = document.createElement("div")
        content.className = "egp-shell"

        content.innerHTML = `
<meta name="viewport" content="width=device-width, initial-scale=1">
    <div class="egp-sidebar">
        <img src="${this.companyLogo}" alt="EgolePay">
        <div class="egp-amount-box">
            <div class="lbl">Amount to pay</div>
            <div class="val">₦${Number.parseFloat(amount).toLocaleString()}</div>
            <div class="sub">Fees included</div>
        </div>
        <div class="egp-sb-menu">
            <div id="paytransfer" class="egp-sb-item menu-item focused">Pay with Transfer</div>
            <div id="card" class="egp-sb-item menu-item">Pay with Card</div>
            <div id="wallet" class="egp-sb-item menu-item" style="display:none;">Pay with Wallet</div>
            <div id="fundaccount" class="egp-sb-item menu-item" style="display:none;">Fund Wallet Account</div>
            <div id="pos" class="egp-sb-item menu-item" style="display:none;">Pay on POS</div>
        </div>
        <div class="egp-sb-secure">Secured by EgolePay</div>
    </div>

    <div class="egp-main">
        <button class="egp-close" id="payment-close-btn" aria-label="Close" title="Close">&times;</button>
        <div class="egp-main-header">
            <h2>Complete your payment</h2>
            <p>Choose a payment method below</p>
        </div>
        <div id="payment-form" class="egp-panels">
            <div style="text-align:center;padding:60px 20px;">
                <div class="egp-spinner-lg"></div>
                <p style="color:#64748b;font-size:14px;font-weight:600;margin-top:12px;">Loading transfer form...</p>
            </div>
        </div>
    </div>
    `

        const closeBtn = content.querySelector("#payment-close-btn")
        if (closeBtn) closeBtn.addEventListener("click", () => this.handleClose("USER_CLOSED_X_BUTTON"))

        popup.appendChild(content)
        return popup
    }

    validateCardPaymentInputsBKKK() {
        const cmobileInput = this.mobile//document.getElementById('cmobile');
        const emailAlertInput = this.email;//document.getElementById('emailAlert');
        const ccnumInput = document.getElementById('ccnum');
        const expiryInput = document.getElementById('expiry');
        const cvvInput = document.getElementById('cvv');
        const pinInput = document.getElementById('pin');

        // Check if elements exist
        if (!cmobileInput || !emailAlertInput || !ccnumInput || !expiryInput || !cvvInput || !pinInput) {
            return false;
        }

        // Validation patterns
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^(\+234[0-9]{10}|0[0-9]{10})$/;
        const cardRegex = /^\d{4}-\d{4}-\d{4}-\d{4}$/;
        const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
        const cvvRegex = /^\d{3}$/;
        const pinRegex = /^\d{4}$/;

        let isValid = true;
        let firstInvalidField = null;

        // Helper function to show error
        const showError = (input, message) => {
            input.classList.add('error');
            input.style.borderColor = '#dc3545';
            input.style.backgroundColor = '#fff5f5';

            // Create or update error message
            let errorSpan = input.parentElement.querySelector('.error-message');
            if (!errorSpan) {
                errorSpan = document.createElement('span');
                errorSpan.className = 'error-message';
                errorSpan.style.cssText = 'display: block; color: #dc3545; font-size: 11px; margin-top: 4px; font-weight: 500;';
                input.parentElement.appendChild(errorSpan);
            }
            errorSpan.textContent = message;

            if (!firstInvalidField) {
                firstInvalidField = input;
            }
            isValid = false;
        };

        // Helper function to clear error
        const clearError = (input) => {
            input.classList.remove('error');
            input.style.borderColor = '';
            input.style.backgroundColor = '';

            const errorSpan = input.parentElement.querySelector('.error-message');
            if (errorSpan) {
                errorSpan.remove();
            }
        };

        // Validate Phone Number
        const phoneValue = cmobileInput;//.value.trim();
        if (!phoneValue) {
            showError(cmobileInput, 'Phone number is required');
        } else if (!phoneRegex.test(phoneValue)) {
            showError(cmobileInput, 'Please enter a valid phone number (+234XXXXXXXXXX or 0XXXXXXXXXX)');
        } else {
            clearError(cmobileInput);
        }

        // Validate Email
        const emailValue = emailAlertInput.value.trim();
        if (!emailValue) {
            showError(emailAlertInput, 'Email is required');
        } else if (!emailRegex.test(emailValue)) {
            showError(emailAlertInput, 'Please enter a valid email address');
        } else {
            clearError(emailAlertInput);
        }

        // Validate Card Number
        const cardValue = ccnumInput.value.trim();
        if (!cardValue) {
            showError(ccnumInput, 'Card number is required');
        } else {
            // Remove dashes for validation
            const cardDigits = cardValue.replace(/-/g, '');

            // Card numbers are typically 13-19 digits (Visa: 13/16, Mastercard: 16, Amex: 15, etc.)
            if (cardDigits.length < 13 || cardDigits.length > 19) {
                showError(ccnumInput, 'Card number must be between 13-19 digits');
            } else if (!/^\d+$/.test(cardDigits)) {
                showError(ccnumInput, 'Card number must contain only digits');
            } else {
                clearError(ccnumInput);
            }
        }

        // Validate Expiry Date
        const expiryValue = expiryInput.value.trim();
        if (!expiryValue) {
            showError(expiryInput, 'Expiry date is required');
        } else if (!expiryRegex.test(expiryValue)) {
            showError(expiryInput, 'Expiry must be in format: MM/YY');
        } else {
            // Check if card is not expired
            const [month, year] = expiryValue.split('/').map(Number);
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear() % 100; // Get last 2 digits
            const currentMonth = currentDate.getMonth() + 1;

            if (year < currentYear || (year === currentYear && month < currentMonth)) {
                showError(expiryInput, 'Card has expired');
            } else {
                clearError(expiryInput);
            }
        }

        // Validate CVV
        const cvvValue = cvvInput.value.trim();
        if (!cvvValue) {
            showError(cvvInput, 'CVV is required');
        } else if (!cvvRegex.test(cvvValue)) {
            showError(cvvInput, 'CVV must be 3 digits');
        } else {
            clearError(cvvInput);
        }

        // Validate PIN
        const pinValue = pinInput.value.trim();
        if (!pinValue) {
            showError(pinInput, 'PIN is required');
        } else if (!pinRegex.test(pinValue)) {
            showError(pinInput, 'PIN must be 4 digits');
        } else {
            clearError(pinInput);
        }

        // Focus first invalid field
        if (firstInvalidField) {
            firstInvalidField.focus();
        }

        return isValid;
    }

    validateCardPaymentInputs() {
        //const mobileValue = this.mobile?.trim() || "";
        const emailValue = this.email?.trim() || "";

        const ccnumInput = document.getElementById("ccnum");
        const expiryInput = document.getElementById("expiry");
        const cvvInput = document.getElementById("cvv");
        const pinInput = document.getElementById("pin");

        // Check required card elements
        if (!ccnumInput || !expiryInput || !cvvInput || !pinInput) {
            return false;
        }

        // Validation patterns
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^(\+234[0-9]{10}|0[0-9]{10})$/;
        const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
        const cvvRegex = /^\d{3}$/;
        const pinRegex = /^\d{4}$/;

        let isValid = true;
        let firstInvalidField = null;

        const showError = (input, message) => {
            if (!input) return;

            input.classList.add("error");
            input.style.borderColor = "#dc3545";
            input.style.backgroundColor = "#fff5f5";

            let errorSpan = input.parentElement.querySelector(".error-message");

            if (!errorSpan) {
                errorSpan = document.createElement("span");
                errorSpan.className = "error-message";
                errorSpan.style.cssText =
                    "display:block;color:#dc3545;font-size:11px;margin-top:4px;font-weight:500;";
                input.parentElement.appendChild(errorSpan);
            }

            errorSpan.textContent = message;

            if (!firstInvalidField) {
                firstInvalidField = input;
            }

            isValid = false;
        };

        const clearError = (input) => {
            if (!input) return;

            input.classList.remove("error");
            input.style.borderColor = "";
            input.style.backgroundColor = "";

            input.parentElement
                ?.querySelector(".error-message")
                ?.remove();
        };

        // Validate mobile (value only)
        //if (!mobileValue) {
        //    this.showErrTypeModal("Phone number is required.");
        //    return false;
        //}

        //if (!phoneRegex.test(mobileValue)) {
        //    this.showErrTypeModal("Please enter a valid phone number (+234XXXXXXXXXX or 0XXXXXXXXXX).");
        //    return false;
        //}

        // Validate email (value only)
        if (!emailValue) {
            this.showErrTypeModal("Email address is required.");
            return false;
        }

        if (!emailRegex.test(emailValue)) {
            this.showErrTypeModal("Please enter a valid email address.");
            return false;
        }

        // Validate Card Number
        const cardValue = ccnumInput.value.trim();
        if (!cardValue) {
            showError(ccnumInput, "Card number is required");
        } else {
            const cardDigits = cardValue.replace(/-/g, "");

            if (cardDigits.length < 13 || cardDigits.length > 19) {
                showError(ccnumInput, "Card number must be between 13 and 19 digits");
            } else if (!/^\d+$/.test(cardDigits)) {
                showError(ccnumInput, "Card number must contain only digits");
            } else {
                clearError(ccnumInput);
            }
        }

        // Validate Expiry
        const expiryValue = expiryInput.value.trim();

        if (!expiryValue) {
            showError(expiryInput, "Expiry date is required");
        } else if (!expiryRegex.test(expiryValue)) {
            showError(expiryInput, "Expiry must be in MM/YY format");
        } else {
            const [month, year] = expiryValue.split("/").map(Number);
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            const currentYear = today.getFullYear() % 100;

            if (year < currentYear || (year === currentYear && month < currentMonth)) {
                showError(expiryInput, "Card has expired");
            } else {
                clearError(expiryInput);
            }
        }

        // Validate CVV
        const cvvValue = cvvInput.value.trim();

        if (!cvvValue) {
            showError(cvvInput, "CVV is required");
        } else if (!cvvRegex.test(cvvValue)) {
            showError(cvvInput, "CVV must be 3 digits");
        } else {
            clearError(cvvInput);
        }

        // Validate PIN
        const pinValue = pinInput.value.trim();

        if (!pinValue) {
            showError(pinInput, "PIN is required");
        } else if (!pinRegex.test(pinValue)) {
            showError(pinInput, "PIN must be 4 digits");
        } else {
            clearError(pinInput);
        }

        if (firstInvalidField) {
            firstInvalidField.focus();
        }

        return isValid;
    }

    createCardPaymentFormPrevious(amount) {
        return `
  <div class="modern-payment-form">
    <h3 class="egp-title">Card Payment</h3>
    <p class="egp-subtitle">Secure payment processed with encryption</p>

    <div class="egp-card-icons">
      <img src="https://res.cloudinary.com/dl9m2dzgk/image/upload/v1728658969/verve_copy_gufwqi.png" alt="Verve">
      <img src="https://res.cloudinary.com/dl9m2dzgk/image/upload/v1728658969/masterCard_copy_brm2z9.png" alt="Mastercard">
      <img src="https://res.cloudinary.com/dl9m2dzgk/image/upload/v1728658969/Visa_copy_uzr8ge.png" alt="Visa">
    </div>

    <div>
      <label class="egp-label" for="cmobile">Phone Number</label>
      <input id="cmobile" name="cmobile" type="text" placeholder="+234XXXXXXXXXX" autocomplete="one-time-code" class="egp-input" required>
    </div>

    <div>
      <label class="egp-label" for="emailAlert">Email</label>
      <input id="emailAlert" name="emailAlert" type="email" placeholder="example@email.com" autocomplete="one-time-code" class="egp-input" required>
    </div>

    <div>
      <label class="egp-label" for="amountToPay">Amount Due to Pay</label>
      <input id="amountToPay" name="amountToPay" value="\u20A6${Number.parseFloat(amount).toLocaleString()}" class="egp-input readonly" readonly />
    </div>

    <div>
      <label class="egp-label" for="ccnum">Card Number</label>
      <input type="text" id="ccnum" name="cardnumber" placeholder="xxxx-xxxx-xxxx-xxxx" autocomplete="one-time-code" maxlength="23" class="egp-input" required>
    </div>

    <div class="egp-row">
      <div>
        <label class="egp-label" for="expiry">Expiry</label>
        <input id="expiry" name="expiry" type="text" placeholder="MM/YY" autocomplete="one-time-code" maxlength="5" class="egp-input" required>
      </div>
      <div>
        <label class="egp-label" for="cvv">CVV</label>
        <input id="cvv" name="cvv" type="text" placeholder="123" autocomplete="one-time-code" maxlength="3" class="egp-input" required>
      </div>
    </div>

    <div>
      <label class="egp-label" for="pin">Card PIN</label>
      <input id="pin" name="pin" type="password" placeholder="\u2022\u2022\u2022\u2022" autocomplete="one-time-code" class="egp-input pin-mask" maxlength="4" required>
    </div>

    <button class="egp-btn egp-btn-primary" type="button" id="pay-now">Pay Securely</button>
    <button class="egp-btn egp-btn-secondary" type="button" id="cancel-payment">Cancel</button>

    <div class="egp-secure-note">Your payment is secured with encryption</div>
  </div>
`
    }

    createCardPaymentForm(amount) {
        return `
  <div class="modern-payment-form">
    <h3 class="egp-title">Card Payment</h3>
    <p class="egp-subtitle">Secure payment processed with encryption</p>

    <div class="egp-card-icons">
      <img src="https://res.cloudinary.com/dl9m2dzgk/image/upload/v1728658969/verve_copy_gufwqi.png" alt="Verve">
      <img src="https://res.cloudinary.com/dl9m2dzgk/image/upload/v1728658969/masterCard_copy_brm2z9.png" alt="Mastercard">
      <img src="https://res.cloudinary.com/dl9m2dzgk/image/upload/v1728658969/Visa_copy_uzr8ge.png" alt="Visa">
    </div>

    <div>
      <label class="egp-label" for="amountToPay">Amount Due to Pay</label>
      <input id="amountToPay" name="amountToPay" value="\u20A6${Number.parseFloat(amount).toLocaleString()}" class="egp-input readonly" readonly />
    </div>

    <div>
      <label class="egp-label" for="ccnum">Card Number</label>
      <input type="text" id="ccnum" name="cardnumber" placeholder="xxxx-xxxx-xxxx-xxxx" autocomplete="one-time-code" maxlength="23" class="egp-input" required>
    </div>

    <div class="egp-row">
      <div>
        <label class="egp-label" for="expiry">Expiry</label>
        <input id="expiry" name="expiry" type="text" placeholder="MM/YY" autocomplete="one-time-code" maxlength="5" class="egp-input" required>
      </div>
      <div>
        <label class="egp-label" for="cvv">CVV</label>
        <input id="cvv" name="cvv" type="text" placeholder="123" autocomplete="one-time-code" maxlength="3" class="egp-input" required>
      </div>
    </div>

    <div>
      <label class="egp-label" for="pin">Card PIN</label>
      <input id="pin" name="pin" type="password" placeholder="\u2022\u2022\u2022\u2022" autocomplete="one-time-code" class="egp-input pin-mask" maxlength="4" required>
    </div>

    <button class="egp-btn egp-btn-primary" type="button" id="pay-now">Pay Securely</button>
    <button class="egp-btn egp-btn-secondary" type="button" id="cancel-payment">Cancel</button>

    <div class="egp-secure-note">Your payment is secured with encryption</div>
  </div>
`
    }

    showCardPaymentForm(webGuid, pid, amount, payerName, creditAccount, cbnCode, amountDue, revName, agencyName, transRef) {
        this.lastPaymentMethod = "card"
        this.updateStep("card_payment_form");
        this.removePopup("confirmbill-popup")
        this.removePopup("error-modal")

        const formContent = this.createCardPaymentForm(amount)
        document.getElementById("payment-form").innerHTML = formContent

        const popupFooter = document.getElementById("pay-now")
        if (popupFooter) {
            popupFooter.style.display = "block"
        }

        // Setup input formatting and clearing errors
        this.setupCardInputFormatting();

        // Add event listeners
        document.getElementById("pay-now").addEventListener("click", () => {
            // VALIDATE FIRST before processing payment
            if (!this.validateCardPaymentInputs()) {
                return;
            }

            // If validation passes, proceed with payment
            this.handlePaymentSubmission(webGuid, pid, amount, payerName, creditAccount, cbnCode, amountDue, revName, agencyName, transRef)
        })

        document.getElementById("cancel-payment").addEventListener("click", () => {
            this.removePopup("payment-popup");
            this.getBillConfirmationPopup();
        });
    }

    showFundWalletForm(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef) {
        this.updateStep("fund_wallet_form");
        this.removePopup("error-modal")

        // Show loading state in the payment form area
        document.getElementById("payment-form").innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; height: 300px;">
        <div style="text-align: center;">
            <div class="egp-spinner-lg"></div>
            <p style="margin-top: 20px; color: #666;">Loading wallet funding form...</p>
        </div>
    </div>
`

        // Generate a unique transaction reference if not provided
        if (!transRef) {
            transRef = "EGPWP" + this.generateEGPRandomString()
        }

        // Call createFundWalletForm with proper parameters
        this.createFundWalletForm(webGuid, pid, amount, transRef, agencyName).then((formContent) => {
            // Update the payment form with the returned HTML content
            document.getElementById("payment-form").innerHTML = formContent

            // Add event listeners after the form is rendered
            const payButton = document.getElementById("wallet-pay-now")
            const cancelButton = document.getElementById("cancel-wallet-payment")
            const copyGlobusAccount = document.getElementById("copy-globus-account")
            const copySterlingAccount = document.getElementById("copy-sterling-account")

            if (cancelButton) {
                cancelButton.addEventListener("click", this.handleCancel.bind(this))
            }

            if (payButton) {
                payButton.addEventListener("click", () => {
                    this.processWalletPayment(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName)
                })
            }

            // Copy account number functionality
            if (copyGlobusAccount) {
                copyGlobusAccount.addEventListener("click", () => {
                    const accountNumber = document.getElementById("globus-account-number").textContent
                    navigator.clipboard.writeText(accountNumber).then(() => {
                        this.showNotification("Globus account number copied!", "success")
                    })
                })
            }

            if (copySterlingAccount) {
                copySterlingAccount.addEventListener("click", () => {
                    const accountNumber = document.getElementById("sterling-account-number").textContent
                    navigator.clipboard.writeText(accountNumber).then(() => {
                        this.showNotification("Sterling account number copied!", "success")
                    })
                })
            }
        })
    }

    createFundWalletForm(webGuid, pid, amount, transRef, agencyName) {
        this.showOverlay("Processing, please wait...")

        // For now, using static values as requested
        const walletData = {
            wallet: "Egole/mvva ikeja",
            account: "345867901",
            totalAmount: amount, // Using the bill amount
            globusBank: {
                bankName: "Globus Bank",
                accountNumber: "1234567890",
                accountName: "EGOLE PAYMENT ACCOUNT"
            },
            sterlingBank: {
                bankName: "Sterling Bank",
                accountNumber: "0987654321",
                accountName: "EGOLE PAYMENT ACCOUNT"
            }
        }

        // Simulate API call - replace with actual API endpoint when available
        return new Promise((resolve) => {
            setTimeout(() => {
                this.hideOverlay()
                resolve(this.generateWalletFormHTML(walletData))
            }, 500)
        })

        /*
        // Uncomment when API is ready
        const requestPayload = {
            apiKey: "YOUR_API_KEY",
            email: "RevPay@gmail.com",
            amount: amount,
            txnRef: webGuid,
            transRef: transRef,
            wallet: "Egole/mvva ikeja",
        }

        return fetch(this.walletFundingEndpoint, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(requestPayload),
        })
            .then((response) => {
                if (!response.ok) {
                    return response.json().then((errData) => {
                        throw new Error(errData.message || response.statusText)
                    })
                }
                return response.json()
            })
            .then((data) => {
                this.hideOverlay()
                if (data.StatusCode !== 200) {
                    throw new Error(data.OperationMessage)
                }
                return this.generateWalletFormHTML(data)
            })
            .catch((error) => {
                this.hideOverlay()
                return this.generateErrorHTML(error)
            })
        */
    }

    generateWalletFormHTML(walletData) {
        return `
    <div class="fund-wallet-form">
        <h3 class="egp-title">Fund Wallet</h3>
        <p class="egp-subtitle">Transfer to either bank account to fund your wallet</p>

        <div class="egp-info-box" style="background:#fff7ed;border-color:#fed7aa;">
            <div class="egp-bank-row"><span class="lbl">Wallet</span><span class="val">${walletData.wallet}</span></div>
            <div class="egp-bank-row"><span class="lbl">Account</span><span class="val">${walletData.account}</span></div>
            <div class="egp-bank-row"><span class="lbl">Total Amount</span><span class="val accent">₦${Number.parseFloat(walletData.totalAmount).toLocaleString()}</span></div>
        </div>

        <div class="egp-bank-box">
            <div class="egp-bank-row"><span class="lbl" style="font-weight:700;color:#0f172a;">Globus Bank</span><span class="val"></span></div>
            <div class="egp-bank-row"><span class="lbl">Bank Name</span><span class="val">${walletData.globusBank.bankName}</span></div>
            <div class="egp-bank-row"><span class="lbl">Account Number</span><span class="val"><span id="globus-account-number">${walletData.globusBank.accountNumber}</span><button type="button" class="egp-copy-btn" id="copy-globus-account" title="Copy to clipboard">Copy</button></span></div>
            <div class="egp-bank-row"><span class="lbl">Account Name</span><span class="val">${walletData.globusBank.accountName}</span></div>
        </div>

        <div class="egp-bank-box">
            <div class="egp-bank-row"><span class="lbl" style="font-weight:700;color:#0f172a;">Sterling Bank</span><span class="val"></span></div>
            <div class="egp-bank-row"><span class="lbl">Bank Name</span><span class="val">${walletData.sterlingBank.bankName}</span></div>
            <div class="egp-bank-row"><span class="lbl">Account Number</span><span class="val"><span id="sterling-account-number">${walletData.sterlingBank.accountNumber}</span><button type="button" class="egp-copy-btn" id="copy-sterling-account" title="Copy to clipboard">Copy</button></span></div>
            <div class="egp-bank-row"><span class="lbl">Account Name</span><span class="val">${walletData.sterlingBank.accountName}</span></div>
        </div>

        <button class="egp-btn egp-btn-primary" type="button" id="wallet-pay-now">Pay</button>
        <button class="egp-btn egp-btn-secondary" type="button" id="cancel-wallet-payment">Cancel</button>
    </div>
`
    }

    showPayWithWalletForm(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef) {
        this.updateStep("wallet_payment_form");
        this.removePopup("error-modal");

        document.getElementById("payment-form").innerHTML = `
        <div style="display:flex;justify-content:center;align-items:center;height:300px;">
            <div style="text-align:center;">
                <div class="egp-spinner-lg"></div>
                <p style="margin-top:20px;color:#666;">Loading wallet...</p>
            </div>
        </div>
    `;

        const walletData = {
            wallet: "Egole/mvva ikeja",
            account: "345867901",
            totalAmount: amount,
        };

        document.getElementById("payment-form").innerHTML = this.generatePayWithWalletHTML(walletData);

        // Wire up input error-clearing
        ["wallet-phone", "wallet-email"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener("input", () => {
                el.classList.remove("error");
                const errEl = document.getElementById(id + "-error");
                if (errEl) errEl.textContent = "";
            });
        });

        // Pay button
        const payBtn = document.getElementById("wallet-pay-now");
        if (payBtn) {
            payBtn.addEventListener("click", () => {
                this.processWalletPayment(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName);
            });
        }

        // Cancel button
        const cancelBtn = document.getElementById("cancel-wallet-payment");
        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => this.handleCancel());
        }
    }

    generatePayWithWalletHTML(walletData) {
        return `
    <div class="wpw-form">
        <h3 class="egp-title">Pay with Wallet</h3>
        <p class="egp-subtitle">Use your Egole wallet balance to complete this payment</p>

        <div class="egp-info-box" style="background:#fff7ed;border-color:#fed7aa;">
            <div class="egp-bank-row"><span class="lbl">Wallet</span><span class="val">${walletData.wallet}</span></div>
            <div class="egp-bank-row"><span class="lbl">Account</span><span class="val">${walletData.account}</span></div>
            <div class="egp-bank-row"><span class="lbl">Wallet Balance</span><span class="val" id="wpw-balance-display"><span id="walletBalance"></span>₦125,009.00</span></div>
            <div class="egp-bank-row"><span class="lbl">Total Amount</span><span class="val accent">₦${Number.parseFloat(walletData.totalAmount).toLocaleString()}</span></div>
        </div>

        <div>
            <label class="egp-label" for="wallet-phone">Phone Number</label>
            <input type="text" id="wallet-phone" placeholder="+234XXXXXXXXXX or 0XXXXXXXXXX" autocomplete="off" class="egp-input" style="margin-bottom:4px;" />
            <span id="wallet-phone-error" class="egp-error-text"></span>
        </div>

        <div>
            <label class="egp-label" for="wallet-email">Email</label>
            <input type="email" id="wallet-email" placeholder="example@email.com" autocomplete="off" class="egp-input" style="margin-bottom:4px;" />
            <span id="wallet-email-error" class="egp-error-text"></span>
        </div>

        <button class="egp-btn egp-btn-primary" type="button" id="wallet-pay-now">Pay</button>
        <button class="egp-btn egp-btn-secondary" type="button" id="cancel-wallet-payment">Cancel</button>
    </div>
`;
    }

    generateErrorHTML(error) {
        return `
    <div class="error-container" style="padding: 8px 0; text-align: center;">
        <h3 class="egp-title" style="color:#991b1b;">Error Loading Wallet Form</h3>
        <p class="egp-subtitle">${error.message || "Failed to load wallet funding form. Please try again."}</p>
        <button id="retry-wallet" class="egp-btn egp-btn-primary" style="margin-top:8px;">Retry</button>
    </div>
    `
    }

    processWalletPayment(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName) {
        const phoneInput = document.getElementById("wallet-phone");
        const emailInput = document.getElementById("wallet-email");
        const phoneError = document.getElementById("wallet-phone-error");
        const emailError = document.getElementById("wallet-email-error");

        const phoneRegex = /^(\+234[0-9]{10}|0[0-9]{10})$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        let isValid = true;

        // Reset
        [phoneInput, emailInput].forEach(el => {
            el.classList.remove("error");
        });
        phoneError.textContent = "";
        emailError.textContent = "";

        const phoneVal = phoneInput.value.trim();
        const emailVal = emailInput.value.trim();

        if (!phoneVal) {
            phoneError.textContent = "Phone number is required";
            phoneInput.classList.add("error");
            phoneInput.focus();
            isValid = false;
        } else if (!phoneRegex.test(phoneVal)) {
            phoneError.textContent = "Enter a valid phone number (+234XXXXXXXXXX or 0XXXXXXXXXX)";
            phoneInput.classList.add("error");
            phoneInput.focus();
            isValid = false;
        }

        if (!emailVal) {
            emailError.textContent = "Email is required";
            emailInput.classList.add("error");
            if (isValid) emailInput.focus();
            isValid = false;
        } else if (!emailRegex.test(emailVal)) {
            emailError.textContent = "Enter a valid email address";
            emailInput.classList.add("error");
            if (isValid) emailInput.focus();
            isValid = false;
        }

        if (!isValid) return;

        // ---- proceed with wallet payment API call ----
        this.showOverlay("Processing wallet payment...");

        // TODO: replace the timeout below with your actual wallet payment API call
        setTimeout(() => {
            this.hideOverlay();
            // this.showSuccessModal("Payment successful!", []);
        }, 2000);
    }

    setupCardInputFormatting() {
        // Auto-format card number with dashes (accommodates different card lengths)
        const ccnumInput = document.getElementById('ccnum');
        if (ccnumInput) {
            ccnumInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, ''); // Remove non-digits

                // Limit to max 19 digits (some cards like Maestro can have up to 19)
                value = value.substring(0, 19);

                if (value.length > 0) {
                    // Format with dashes every 4 digits
                    value = value.match(/.{1,4}/g).join('-');
                }

                e.target.value = value;

                // Update maxlength dynamically (19 digits + dashes = 23 characters max)
                e.target.setAttribute('maxlength', '23');

                // Clear error when user types
                const errorSpan = e.target.parentElement.querySelector('.error-message');
                if (errorSpan) {
                    errorSpan.remove();
                }
                e.target.classList.remove('error');
                e.target.style.borderColor = '';
                e.target.style.backgroundColor = '';
            });
        }

        // Auto-format expiry date with slash
        const expiryInput = document.getElementById('expiry');
        if (expiryInput) {
            expiryInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                if (value.length >= 2) {
                    value = value.substring(0, 2) + '/' + value.substring(2, 4);
                }
                e.target.value = value.substring(0, 5);

                // Clear error when user types
                const errorSpan = e.target.parentElement.querySelector('.error-message');
                if (errorSpan) {
                    errorSpan.remove();
                }
                e.target.classList.remove('error');
                e.target.style.borderColor = '';
                e.target.style.backgroundColor = '';
            });
        }

        // Clear errors on input for all fields
        const inputIds = ['cmobile', 'emailAlert', 'cvv', 'pin'];
        inputIds.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', (e) => {
                    // Only allow digits for CVV and PIN
                    if (id === 'cvv' || id === 'pin') {
                        e.target.value = e.target.value.replace(/\D/g, '');
                    }

                    // Clear error when user types
                    const errorSpan = e.target.parentElement.querySelector('.error-message');
                    if (errorSpan) {
                        errorSpan.remove();
                    }
                    e.target.classList.remove('error');
                    e.target.style.borderColor = '';
                    e.target.style.backgroundColor = '';
                });
            }
        });
    }

    //     showDefaultPaymentForm() {
    //         this.updateStep("default_payment_form");
    //         this.removePopup("confirmbill-popup");
    //         this.removePopup("error-modal");
    //
    //         const comingSoonContent = `
    //     <div class="text-center py-5">
    //         <h4 class="fw-bold mb-2">Coming Soon 🚧</h4>
    //         <p class="text-muted mb-4">
    //             This payment method is currently under development.
    //         </p>
    //         <button id="back-to-bill" class="btn btn-outline-secondary">
    //             Go Back
    //         </button>
    //     </div>
    // `;
    //
    //         document.getElementById("payment-form").innerHTML = comingSoonContent;
    //
    //         const popupFooter = document.getElementById("pay-now");
    //         if (popupFooter) {
    //             popupFooter.style.display = "none";
    //         }
    //
    //         document.getElementById("back-to-bill").addEventListener("click", () => {
    //             this.removePopup("payment-popup");
    //             this.getBillConfirmationPopup();
    //         });
    //     }

    // Handle payment submission
    handlePaymentSubmission(webGuid, pid, amount, payerName, creditAccount, cbnCode, amountDue, revName, agencyName, transRef,) {
        const selectedOption = "card"
        if (selectedOption === "card") {
            this.processCardPayment(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef)
        }
    }

    // Get bank name from code
    getBankName(code) {
        const bankCodes = {
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
        }

        return bankCodes[code] || "Bank code not found"
    }

    // Generate random string for reference
    generateRandomString(length = 8) {
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
        let result = ""
        const charactersLength = characters.length

        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength))
        }

        return result
    }

    // Generate EGP random string with timestamp
    generateEGPRandomString(length = 2) {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, "0")
        const day = String(now.getDate()).padStart(2, "0")
        const hours = String(now.getHours()).padStart(2, "0")
        const minutes = String(now.getMinutes()).padStart(2, "0")
        const seconds = String(now.getSeconds()).padStart(2, "0")
        const dateTimeString = `${year}${month}${day}${hours}${minutes}${seconds}`

        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
        let randomPart = ""
        const charactersLength = characters.length

        for (let i = 0; i < length; i++) {
            randomPart += characters.charAt(Math.floor(Math.random() * charactersLength))
        }

        return `${randomPart}${dateTimeString}`
    }

    // Validate card information
    validateCardInformation(pan, expiryDate, cvv) {
        const panRegex = /^\d{13,19}$/
        if (!panRegex.test(pan)) {
            return "Invalid PAN. PAN must be 13 to 19 digits."
        }

        const expiryDateRegex = /^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/
        if (!expiryDateRegex.test(expiryDate)) {
            return "Invalid Expiry Date. Use MM/YY or MM/YYYY format."
        }

        const cvvRegex = /^\d{3,4}$/
        if (!cvvRegex.test(cvv)) {
            return "Invalid CVV. CVV must be 3 or 4 digits."
        }

        return "Card information is valid."
    }

    // Validate email format
    validateEmail(emailInput) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(emailInput)
    }

    // Calculate original amount from total
    calculateOriginalAmount(totalAmount, agencyName = "") {
        const total = this.convertToNumber(totalAmount)
        if (total === null || isNaN(total)) return 0

        // Start by estimating the original amount
        let estimatedOriginal = total

        // Loop to refine estimate
        for (let i = 0; i < 20; i++) {
            let fee = estimatedOriginal * 0.01
            if (fee < 100) fee = 100
            if (fee > 1200) fee = 1200

            const specialFee = this.hasSpecialServiceFee(agencyName) ? 0 : 0
            const newEstimate = total - fee - specialFee

            if (Math.abs(newEstimate - estimatedOriginal) < 0.01) break

            estimatedOriginal = newEstimate
        }

        return estimatedOriginal.toFixed(2)
    }

    cleanCardNumber(cardNumber) {
        if (!cardNumber) return '';
        return cardNumber.replace(/\D/g, ''); // Remove all non-digit characters (dashes, spaces, etc.)
    }

    // Normalise the expiry to MM/YY, since the gateway expects the slash in the payload.
    cleanExpiryDate(expiryDate) {
        if (!expiryDate) return '';

        const digits = String(expiryDate).replace(/\D/g, '');
        if (digits.length < 4) return digits;

        const month = digits.slice(0, 2);
        const year = digits.slice(-2); // handles MM/YY and MM/YYYY alike

        return `${month}/${year}`;
    }

    // Process card payment
    processCardPaymentPrevious(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef) {
        // Get form values
        const cardNumber = document.getElementById("ccnum").value
        const expiry = document.getElementById("expiry").value
        const cvv = document.getElementById("cvv").value
        const mobile = this.mobile//document.getElementById("cmobile").value
        const pin = document.getElementById("pin").value
        const amountToPay = document.getElementById("amountToPay").innerHTML
        const emailAlert = this.email//document.getElementById("emailAlert").value
        const amountPaid = this.calculateOriginalAmount(amount, agencyName)
        const amountCrd = amount
        const cleanedCardNumber = this.cleanCardNumber(cardNumber);
        const cleanedExpiryDate = this.cleanExpiryDate(expiry);
        // Validate email
        if (!this.validateEmail(emailAlert)) {
            this.showErrorModal("Please enter a valid email to get the payment receipt.")
            return
        }

        //if (!this.mobile) {
        //    this.showErrorModal("Please enter a valid Mobile Number.")
        //    return
        //}

        // Validate card details
        if (cardNumber && expiry && cvv) {
            this.showOverlay("Processing card payment, please wait...")

            // Prepare request payload
            const requestPayload = {
                secretKey: this.apiKey,//this.secretKey,
                pan: cleanedCardNumber,
                expiry: cleanedExpiryDate,
                amount: amountPaid.toString(),
                cvv: cvv,
                cardholder: "egpcus",
                mobile: mobile,
                pin: pin,
                description: "LASG-Tax",
                transRef: this.transRef,
                tnxRef: pid,
                WebGuid: webGuid,
                tAmount: amount,
                settlementBank: this.getBankName(cbnCode),
                settlementAccount: creditAccount,
                settlementCode: cbnCode,
                agencyName: agencyName,
                revenueName: revName,
                payerEmail: emailAlert,
                creditAccount: creditAccount,
            }
            this.amountCrd = amountCrd
            // A new authorisation is starting, so the OTP screen is allowed once more.
            this.otpPopupShown = false

            fetch(this.paymentEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestPayload),
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`)
                    }
                    return response.json()
                })
                .then((data) => {
                    this.hideOverlay()

                    if (data.errors && data.errors.length > 0) {
                        this.showErrorModal("Payment failed. Please try again.")
                    } else {
                        const refNo = data.paymentId
                        const authData = data.authData

                        if (!data.message.includes("OTP sent")) {
                            this.showErrorModal(data.message)
                        } else {
                            // Prepare data for OTP verification
                            const emaildata = JSON.stringify({
                                paymentId: data.paymentId,
                                email: emailAlert,
                                maskPan: this.maskCardNumber(cardNumber),
                                description: this.description,
                                webGuid: webGuid,
                                amountPaid: amountPaid,
                                paymentRef: data.paymentId,
                                creditAccount: creditAccount,
                                date: "2025-03-12",
                                paymentChannel: "Web Platform",
                                tellerName: payerName,
                                bankNote: this.generateRandomString(8),
                                userFullName: payerName || "-",
                            })

                            this.showOtpPopup(refNo, emaildata, authData)
                        }
                    }
                })
                .catch((error) => {
                    this.hideOverlay()
                    // Handle fetch error
                    this.showErrorModal("Payment failed. Please try again.")
                })
        } else {
            this.showErrorModal("Please fill in all the fields.")
        }
    }

    processCardPayment(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef) {

        // Get form values
        const cardNumber = document.getElementById("ccnum")?.value;
        const expiry = document.getElementById("expiry")?.value;
        const cvv = document.getElementById("cvv")?.value;
        const mobile = this.mobile;//document.getElementById("cmobile")?.value;
        const pin = document.getElementById("pin")?.value;
        const amountToPay = document.getElementById("amountToPay")?.innerHTML;
        const emailAlert = this.email;//document.getElementById("emailAlert")?.value;

        // Prevent rapid successive calls
        if (this.isProcessingPayment) {

            return;
        }

        // Validate email
        if (!this.validateEmail(emailAlert)) {

            this.showErrorModal("Please enter a valid email to get the payment receipt.");

            return;
        }

        // Check if required elements exist
        const missingElements = [];
        if (!document.getElementById("ccnum")) missingElements.push("ccnum");
        if (!document.getElementById("expiry")) missingElements.push("expiry");
        if (!document.getElementById("cvv")) missingElements.push("cvv");
        if (!document.getElementById("amountToPay")) missingElements.push("amountToPay");

        if (missingElements.length > 0) {

            this.showErrorModal("Form elements not found. Please refresh the page and try again.");

            return;
        }

        // Validate card details
        if (!cardNumber || !expiry || !cvv) {

            this.showErrorModal("Please fill in all the card fields.");

            return;
        }

        try {
            // Calculate amounts
            const amountPaid = this.calculateOriginalAmount(amount, agencyName);
            const amountCrd = amount;
            const cleanedCardNumber = this.cleanCardNumber(cardNumber);
            const cleanedExpiryDate = this.cleanExpiryDate(expiry);

            this.isProcessingPayment = true;
            this.showOverlay("Processing card payment, please wait...");

            // Prepare request payload
            const requestPayload = {
                secretKey: this.apiKey,//this.secretKey,
                pan: cleanedCardNumber,
                expiry: cleanedExpiryDate,
                amount: amountPaid.toString(),
                cvv: cvv,
                cardholder: "egpcus",
                mobile: mobile,
                pin: pin,
                description: "LASG-Tax",
                transRef: this.transRef,
                tnxRef: pid,
                WebGuid: webGuid,
                tAmount: amount,
                settlementBank: this.getBankName(cbnCode),
                settlementAccount: creditAccount,
                settlementCode: cbnCode,
                agencyName: agencyName,
                revenueName: revName,
                payerEmail: emailAlert,
                creditAccount: creditAccount,
            };

            this.amountCrd = amountCrd;
            // A new authorisation is starting, so the OTP screen is allowed once more.
            this.otpPopupShown = false

            this.processCardPaymentWithRetry(requestPayload)
                .then((envelope) => {
                    this.isProcessingPayment = false;
                    this.hideOverlay();

                    // ✅ Pass the whole envelope — handler unwraps internally
                    this.handleCardPaymentResponse(
                        envelope,
                        emailAlert,
                        cardNumber,
                        amountPaid,
                        webGuid,
                        creditAccount,
                        payerName
                    );
                })
                .catch((error) => {
                    this.isProcessingPayment = false;
                    this.hideOverlay();

                    if (error.message.includes("rate limit") || error.message.includes("Too many requests")) {
                        this.showErrorModal("Too many attempts. Please wait a moment and try again.");
                    } else if (error.message.includes("timeout")) {
                        this.showErrorModal("Request timed out. Please check your connection and try again.");
                    } else if (error.message.includes("Invalid response")) {
                        this.showErrorModal("Received invalid response from payment server. Please try again.");
                    } else {
                        this.showErrorModal(error.message || "Payment failed. Please try again.");
                    }
                });

        } catch (error) {

            this.showErrorModal("An unexpected error occurred. Please try again.");

        }
    }

    async processCardPaymentWithRetry(payload, maxRetries = 3) {

        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {

                const startTime = Date.now();

                const controller = new AbortController();
                const timeoutId = setTimeout(() => {

                    controller.abort();
                }, 30000); // 30 second timeout

                const response = await fetch(this.paymentEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;

                // Handle rate limiting
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;

                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                // Handle server errors with retry
                if (response.status >= 500 && response.status < 600) {

                    if (attempt < maxRetries) {
                        const waitTime = Math.pow(2, attempt) * 1000;

                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                }

                if (!response.ok) {

                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                // Parse response
                const responseText = await response.text();

                let data;
                try {
                    data = JSON.parse(responseText);

                    return data;
                } catch (parseError) {

                    throw new Error("Invalid response format from payment server");
                }

            } catch (error) {
                lastError = error;

                // Don't retry on abort/timeout
                if (error.name === 'AbortError') {

                    throw new Error("Request timed out. Please try again.");
                }

                // If this was the last attempt, throw the error
                if (attempt === maxRetries) {

                    throw error;
                }

                // Wait before retrying (exponential backoff)
                const waitTime = Math.pow(2, attempt) * 1000;

                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        throw lastError || new Error("Payment verification failed after all retries");
    }

    handleCardPaymentResponse(envelope, emailAlert, cardNumber, amountPaid, webGuid, creditAccount, payerName) {
        try {
            // ── 1. UNWRAP ENVELOPE ────────────────────────────────
            const data = envelope?.Data ?? envelope?.data ?? envelope ?? {};

            // ── 2. NORMALIZE COMMON FIELDS ────────────────────────
            const errors = envelope.Errors ?? envelope.errors ?? data.Errors ?? data.errors ?? null;
            const envelopeStatus = envelope.Status ?? envelope.status ?? null;
            const paymentId = data.PaymentId ?? data.paymentId ?? data.PaymentReference ?? data.paymentReference ?? null;
            const paymentRef = data.PaymentReference ?? data.paymentReference ?? paymentId;
            const authData = data.Authdata ?? data.authData ?? data.AuthData ?? null;
            const message = data.Message ?? data.message ?? envelope.Message ?? envelope.message ?? null;
            const responseCode = data.ResponseCode ?? data.responseCode ?? null;
            const status = data.Status ?? data.status ?? null;
            const plainText = data.PlainTextSupportMessage ?? data.plainTextSupportMessage ?? null;
            const bankCode = data.BankCode ?? data.bankCode ?? null;

            // ── 3. ERROR CHECK (before anything else) ─────────────
            if (errors && typeof errors === "object" && !Array.isArray(errors)) {
                const firstKey = Object.keys(errors)[0];
                const firstErr = Array.isArray(errors[firstKey]) ? errors[firstKey][0] : errors[firstKey];
                if (firstErr) {
                    this.showErrorModal(firstErr);
                    return;
                }
            }

            if (Array.isArray(errors) && errors.length > 0) {
                const first = errors[0];
                this.showErrorModal(first?.Message ?? first?.message ?? "Payment failed. Please try again.");
                return;
            }

            // ── 4. STATUS FALSE = FAILURE ─────────────────────────
            if (envelopeStatus === false) {
                this.showErrorModal(message || "Payment failed. Please try again.");
                return;
            }

            // ── 5. OTP / PENDING DETECTION ────────────────────────
            const isOtpRequired =
                responseCode === "T0" ||
                status === "pending" ||
                (message && message.includes("OTP"));

            if (!isOtpRequired) {
                this.showErrorModal(message || "Payment processing failed");
                return;
            }

            // ── 6. PREPARE OTP VERIFICATION PAYLOAD ──────────────
            const refNo = paymentRef;
            const emaildata = JSON.stringify({
                paymentId: paymentId,
                email: emailAlert,
                maskPan: this.maskCardNumber(cardNumber),
                description: this.description,
                webGuid: webGuid,
                amountPaid: amountPaid,
                paymentRef: paymentId,
                creditAccount: creditAccount,
                date: new Date().toISOString().split('T')[0],
                paymentChannel: "Web Platform",
                tellerName: payerName,
                bankNote: this.generateRandomString(8),
                userFullName: payerName || "-",
            });

            this.showOtpPopup(refNo, emaildata, authData, {
                plainTextSupportMessage: plainText,
                bankCode: bankCode
            });

        } catch (error) {
            this.showErrorModal("Error processing payment response. Please try again.");
        }
    }

    handleCardPaymentResponsePrevious(data, emailAlert, cardNumber, amountPaid, webGuid, creditAccount, payerName) {

        try {
            // Check for errors array
            if (data.errors && data.errors.length > 0) {

                this.showErrorModal("Payment failed. Please try again.");

                return;
            }

            const refNo = data.paymentId;
            const authData = data.authData;

            if (!data.message || !data.message.includes("OTP sent")) {

                this.showErrorModal(data.message || "Payment processing failed");

                return;
            }

            // Prepare data for OTP verification

            const emaildata = JSON.stringify({
                paymentId: data.paymentId,
                email: emailAlert,
                maskPan: this.maskCardNumber(cardNumber),
                description: this.description,
                webGuid: webGuid,
                amountPaid: amountPaid,
                paymentRef: data.paymentId,
                creditAccount: creditAccount,
                date: new Date().toISOString().split('T')[0], // Use current date
                paymentChannel: "Web Platform",
                tellerName: payerName,
                bankNote: this.generateRandomString(8),
                userFullName: payerName || "-",
            });

            this.showOtpPopup(refNo, emaildata, authData);

        } catch (error) {

            this.showErrorModal("Error processing payment response. Please try again.");
        }

    }

    // Put a button into a busy state so an impatient user cannot fire the same
    // request twice. Pairs with restoreButton() on every failure path.
    setButtonBusy(button, busyText) {
        if (!button) return;

        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.disabled = true;
        button.dataset.busy = "true";
        button.textContent = busyText;
        button.style.opacity = "0.7";
        button.style.cursor = "not-allowed";
    }

    restoreButton(button) {
        if (!button || button.dataset.busy !== "true") return;

        button.disabled = false;
        button.dataset.busy = "false";

        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
        }

        button.style.opacity = "";
        button.style.cursor = "pointer";
    }

    // Show OTP verification popup
    showOtpPopup(pid, dataValues, authData, extra = {}) {
        // The OTP screen is shown once per authorisation. Once it has been
        // dismissed (verified, cancelled, or torn down) it must not come back:
        // a second call would stack another #otp-popup on top, and the stale
        // one underneath would still be holding the old authData.
        if (this.otpPopupShown) {
            return
        }
        this.otpPopupShown = true

        this.updateStep("otp_verification")
        this.removePopup("payment-popup")
        this.removePopup("otp-popup")

        const otpPopup = this.createOtpPopup(pid, extra)
        document.body.appendChild(otpPopup)

        // Focus input + digits only
        const otpInput = document.getElementById("otp-input")
        if (otpInput) {
            otpInput.focus()
            otpInput.addEventListener("input", (e) => {
                e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6)
            })
        }

        // Wire up buttons
        const submitBtn = document.getElementById("submit-otp")
        const cancelBtn = document.getElementById("cancel-otp")

        if (!submitBtn || !cancelBtn) {
            return
        }

        const newSubmitBtn = submitBtn.cloneNode(true)
        submitBtn.replaceWith(newSubmitBtn)

        const newCancelBtn = cancelBtn.cloneNode(true)
        cancelBtn.replaceWith(newCancelBtn)

        newSubmitBtn.addEventListener("click", () => {
            this.handleOtpSubmission(pid, dataValues, authData)
        })

        newCancelBtn.addEventListener("click", () => {
            // Full teardown + merchant onCancel, not a silent popup removal.
            this.handleCancel("USER_CANCELLED_OTP")
        })
    }

    showOtpPopupPrevious(pid, dataValues, authData) {
        // The OTP screen is shown once per authorisation. Once it has been
        // dismissed (verified, cancelled, or torn down) it must not come back:
        // a second call would stack another #otp-popup on top, and the stale
        // one underneath would still be holding the old authData.
        if (this.otpPopupShown) {
            return
        }
        this.otpPopupShown = true

        this.updateStep("otp_verification");
        this.removePopup("payment-popup")
        this.removePopup("otp-popup")

        const otpPopup = this.createOtpPopup(pid)
        document.body.appendChild(otpPopup)

        // Use querySelector or ensure elements exist
        const submitBtn = document.getElementById("submit-otp")
        const cancelBtn = document.getElementById("cancel-otp")

        if (!submitBtn || !cancelBtn) {
            return
        }

        const newSubmitBtn = submitBtn.cloneNode(true)
        submitBtn.replaceWith(newSubmitBtn)

        const newCancelBtn = cancelBtn.cloneNode(true)
        cancelBtn.replaceWith(newCancelBtn)

        newSubmitBtn.addEventListener("click", () => {
            this.handleOtpSubmission(pid, dataValues, authData)
        })

        newCancelBtn.addEventListener("click", () => {
            // Full teardown + merchant onCancel, not a silent popup removal.
            this.handleCancel("USER_CANCELLED_OTP")
        })
    }

    // Create OTP verification popup

    createOtpPopupPrevious(pid) {
        const otpPopup = document.createElement("div")
        otpPopup.id = "otp-popup"
        otpPopup.className = "egp-center-modal"
        otpPopup.style.position = "fixed"
        otpPopup.style.top = "50%"
        otpPopup.style.left = "50%"
        otpPopup.style.transform = "translate(-50%, -50%)"
        otpPopup.style.width = "90%"
        otpPopup.style.maxWidth = "360px"
        otpPopup.style.padding = "28px 26px"
        otpPopup.style.zIndex = "1003"

        otpPopup.innerHTML = `
    <h3 class="egp-title" style="text-align:center;">OTP Verification</h3>
    <p class="egp-subtitle" style="text-align:center;">Enter the 6-digit code sent to your phone</p>

    <input type="text" id="otp-input" placeholder="••••••" maxlength="6"
      class="egp-input egp-otp-input" autocomplete="one-time-code" />

    <button id="submit-otp" class="egp-btn egp-btn-primary">Verify OTP</button>
    <button id="cancel-otp" class="egp-btn egp-btn-secondary">Cancel</button>
  `

        return otpPopup
    }
    // Create OTP verification popup (DOM + scoped CSS)
    createOtpPopup(pid, extra = {}) {
        const otpPopup = document.createElement("div")
        otpPopup.id = "otp-popup"
        otpPopup.className = "egp-center-modal"
        otpPopup.style.position = "fixed"
        otpPopup.style.top = "50%"
        otpPopup.style.left = "50%"
        otpPopup.style.transform = "translate(-50%, -50%)"
        otpPopup.style.width = "90%"
        otpPopup.style.maxWidth = "360px"
        otpPopup.style.padding = "28px 26px"
        otpPopup.style.zIndex = "1003"
        otpPopup.style.background = "#ffffff"
        otpPopup.style.borderRadius = "12px"
        otpPopup.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.15)"

        // Prefer the provider's plain-text instruction (e.g., Zenith token).
        // Fall back to the default SMS-style hint.
        const providerMessage = extra?.plainTextSupportMessage
        const subtitle = providerMessage && providerMessage.trim().length > 0
            ? providerMessage
            : "Enter the 6-digit code sent to your phone"

        // Inject scoped CSS once
        if (!document.getElementById("otp-popup-styles")) {
            const style = document.createElement("style")
            style.id = "otp-popup-styles"
            style.textContent = `
            #otp-popup .egp-title {
                margin: 0 0 8px 0;
                font-size: 18px;
                font-weight: 600;
                color: #111827;
                text-align: center;
            }

            #otp-popup .egp-subtitle {
                margin: 0 0 20px 0;
                font-size: 13px;
                line-height: 1.5;
                color: #4b5563;
                text-align: center;
                max-height: 140px;
                overflow-y: auto;
                padding: 0 4px;
                scrollbar-width: thin;
                scrollbar-color: #d1d5db transparent;
            }

            #otp-popup .egp-subtitle::-webkit-scrollbar {
                width: 6px;
            }

            #otp-popup .egp-subtitle::-webkit-scrollbar-thumb {
                background-color: #d1d5db;
                border-radius: 3px;
            }

            #otp-popup .egp-subtitle::-webkit-scrollbar-track {
                background: transparent;
            }

            #otp-popup .egp-otp-input {
                width: 100%;
                padding: 14px 16px;
                margin-bottom: 16px;
                font-size: 22px;
                font-weight: 600;
                letter-spacing: 8px;
                text-align: center;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                background: #f9fafb;
                transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
                box-sizing: border-box;
            }

            #otp-popup .egp-otp-input:focus {
                outline: none;
                border-color: #2563eb;
                background: #ffffff;
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
            }

            #otp-popup .egp-otp-input::placeholder {
                color: #9ca3af;
                letter-spacing: 4px;
            }

            #otp-popup .egp-btn {
                width: 100%;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                border: none;
                transition: opacity 0.15s ease, background 0.15s ease;
                box-sizing: border-box;
            }

            #otp-popup .egp-btn-primary {
                background: #2563eb;
                color: #ffffff;
                margin-bottom: 10px;
            }

            #otp-popup .egp-btn-primary:hover {
                background: #1d4ed8;
            }

            #otp-popup .egp-btn-secondary {
                background: transparent;
                color: #6b7280;
                border: 1px solid #e5e7eb;
            }

            #otp-popup .egp-btn-secondary:hover {
                background: #f9fafb;
                color: #374151;
            }

            @media (max-width: 380px) {
                #otp-popup {
                    width: 95% !important;
                    padding: 20px 18px !important;
                }

                #otp-popup .egp-subtitle {
                    font-size: 12px;
                    max-height: 120px;
                }

                #otp-popup .egp-otp-input {
                    font-size: 20px;
                    letter-spacing: 6px;
                }
            }
        `
            document.head.appendChild(style)
        }

        // Escape provider message before injecting into HTML
        const safeSubtitle = this.escapeHtml(subtitle)

        otpPopup.innerHTML = `
        <h3 class="egp-title">OTP Verification</h3>
        <p class="egp-subtitle">${safeSubtitle}</p>

        <input type="text" id="otp-input" placeholder="••••••" maxlength="6"
               class="egp-otp-input" autocomplete="one-time-code" inputmode="numeric" />

        <button id="submit-otp" class="egp-btn egp-btn-primary">Verify OTP</button>
        <button id="cancel-otp" class="egp-btn egp-btn-secondary">Cancel</button>
    `

        return otpPopup
    }
    // Minimal HTML escape
    escapeHtml(str) {
        if (!str) return ""
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
    }

    handleOtpSubmission(pid, dataValues, authData) {
        const otp = document.getElementById("otp-input")?.value

        if (!otp) {
            this.showErrorModal("Please enter the OTP.")
            return
        }

        const otpButton = document.getElementById("submit-otp")
        this.setButtonBusy(otpButton, "Verifying...")

        this.showOverlay("Verifying OTP, please wait...")

        const parsedDataValues = typeof dataValues === "string" ? JSON.parse(dataValues) : dataValues
        const { webGuid, type } = this.getQueryParams()
        const isWebGuid = type?.toLowerCase() === "webguid"
        const amountFromDom = document.getElementById("va-amount-details")?.textContent || "0"

        const requestPayload = {
            apiKey: "sk_test_REVABC_QXZbHtF6m_oed1QFPAAAY4jFGP3-jyM-wjhgfdf87655678",
            paymentId: parsedDataValues.paymentId || webGuid,
            otp: otp,
            authData: authData,
            email: parsedDataValues.email,
            description: parsedDataValues.description || "",
            ParentGUID: this.getParentGuid(),
            guidType: this.getGuidType(),
            allIsSelected: this.isAllItemsSelected(),
            transItem: [],
        }

        if (this.selectedItemsData && this.selectedItemsData.length > 0) {
            requestPayload.transItem = this.selectedItemsData.map((item, index) => {
                const itemTxnRef = item.webGuid || webGuid
                const paymentRefForItem = this.harmonizeRefs?.[index] || this.transRef

                return {
                    apiKey: "sk_test_REVABC_QXZbHtF6m_oed1QFPAAAY4jFGP3-jyM-wjhgfdf87655678",
                    txnRef: itemTxnRef,
                    paymentRef: paymentRefForItem,
                    paymentChannel: "Web Platform",
                    channel: "Web Platform",
                    creditAccount: item.creditAccount || parsedDataValues.creditAccount,
                    bankNote: parsedDataValues.bankNote,
                    tellerName: parsedDataValues.tellerName,
                    email: parsedDataValues.email,
                    revenueCode: item.revenueCode,
                    revName: item.revName,
                    sourceAcct: this.sourceAccount,
                    agencyCode: item.agencyCode,
                    agencyName: item.agencyName,
                    tnxAmount: isWebGuid ? String(this.amountCrd) : String(Number.parseFloat(item.amountDue || "0").toFixed(2)),
                    currency: item.currency,
                }
            })
        }

        // Exactly what goes on the wire to OTPAuthorization, so guidType and
        // allIsSelected can be eyeballed against what the payer ticked.
        console.log("[EgolePay] OTP verification -> " + this.otpEndpoint, {
            ParentGUID: requestPayload.ParentGUID,
            guidType: requestPayload.guidType,
            allIsSelected: requestPayload.allIsSelected,
            itemsSelected: this.selectedItemsData?.length || 0,
            itemsOnBill: this.totalBillItemCount ?? "(unknown)",
            payload: requestPayload,
        })
        console.log("[EgolePay] OTP verification body\n" + JSON.stringify(requestPayload, null, 2))

        fetch(this.otpEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
        })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return response.json();
            })
            .then((envelope) => {
                this.hideOverlay();

                // ── 1. UNWRAP ENVELOPE ────────────────────────────────
                const data = envelope?.Data ?? envelope?.data ?? envelope ?? {};

                // ── 2. NORMALIZE FIELDS ───────────────────────────────
                const envelopeStatus = envelope.Status ?? envelope.status ?? null;
                const statusCode = data.StatusCode ?? data.statusCode ?? null;
                const payloadStatus = data.Status ?? data.status ?? null;
                const notifyList = data.NotifyList ?? data.notifylist ?? [];
                const merchantReturnUrl = data.MerchantReturnUrl ?? data.merchantReturnUrl ?? null;
                const revName = data.revName ?? data.RevName ?? null;
                const message = data.Message ?? data.message ?? envelope.Message ?? envelope.message ?? null;
                const statusDesc = data.StatusDescription ?? data.statusDescription ?? envelope.StatusDescription ?? null;

                // ── 3. SUCCESS DETECTION ──────────────────────────────
                const isSuccess =
                    envelopeStatus === true ||
                    envelopeStatus === "true" ||
                    statusCode === "00" ||
                    payloadStatus === "00" ||
                    payloadStatus === "success";

                // ── 4. FAILURE ────────────────────────────────────────
                if (!isSuccess) {
                    this.restoreButton(otpButton);

                    const errorMessage =
                        message ||
                        statusDesc ||
                        "OTP verification failed. Please try again.";

                    this.showErrorModal(errorMessage);
                    return;
                }

                // ── 5. SUCCESS — MULTI-ITEM NOTIFY LIST ───────────────
                if (Array.isArray(notifyList) && notifyList.length > 0) {

                    const isSettledItem = (item) => {
                        const s = item.Status ?? item.status ?? item.StatusCode ?? item.statusCode ?? null;
                        return s === "00";
                    };

                    const settledItems = notifyList.filter(isSettledItem);

                    // A settled entry can carry more than one receipt in its
                    // merchantReturnUrl ("$$"-joined). Each unique URL gets its
                    // own download button and its own email.
                    const receiptEntries = [];
                    const itemsWithReceipts = [];

                    settledItems.forEach(item => {
                        const rawUrl = item.merchantReturnUrl ?? item.MerchantReturnUrl ?? "";
                        const urls = this.parseReceiptUrls(rawUrl);   // ← de-duped
                        if (urls.length === 0) return;

                        itemsWithReceipts.push(item);
                        urls.forEach(url => receiptEntries.push({ item, url }));
                    });

                    const downloadLinks = receiptEntries.map(entry => entry.url);
                    const revenueNames = receiptEntries.map(entry =>
                        entry.item.revName ?? entry.item.RevName ?? "Payment Receipt"
                    );

                    const sendEmailTasks = receiptEntries.map(({ item, url }) => {
                        const emailPayload = {
                            product: "",
                            email: parsedDataValues.email,
                            maskPan: parsedDataValues.maskPan,
                            amount: item.Amount ?? item.amount ?? parsedDataValues.amountPaid,
                            transReferenceNo: parsedDataValues.webGuid,
                            userFullName: parsedDataValues.tellerName,
                        };

                        return this.sendEmailPaymentNotification(emailPayload, url);
                    });

                    Promise.all(sendEmailTasks).then(() => {
                        // Counted per bill item, not per receipt: an item either
                        // produced receipts or it did not.
                        const failedCount = notifyList.length - itemsWithReceipts.length;

                        if (downloadLinks.length > 0) {
                            let successMessage = "Payment successful!";

                            if (failedCount > 0) {
                                successMessage = `Payment partially successful! ${itemsWithReceipts.length} item(s) processed successfully, ${failedCount} item(s) failed.`;
                            }

                            this.showSuccessModal(successMessage, downloadLinks, revenueNames);
                        } else {
                            this.showNotifyErrorModal(
                                "Payment processed, but no valid receipts were generated. Please contact support."
                            );
                        }
                    });
                    return;
                }

                // ── 6. SUCCESS — SINGLE RECEIPT ───────────────────────
                if (merchantReturnUrl) {
                    const receiptUrls = this.parseReceiptUrls(merchantReturnUrl);   // ← de-duped
                    const receiptNames = receiptUrls.map(() => revName || "Payment Receipt");

                    if (receiptUrls.length === 0) {
                        this.restoreButton(otpButton);
                        this.showErrorModal(
                            'Payment processed, but no receipts were generated. Please contact support.'
                        );
                        return;
                    }

                    const emailPayload = {
                        product: "",
                        email: parsedDataValues.email,
                        maskPan: parsedDataValues.maskPan,
                        amount: parsedDataValues.amountPaid,
                        transReferenceNo: parsedDataValues.webGuid,
                        userFullName: parsedDataValues.tellerName,
                    };

                    Promise.all(receiptUrls.map(url => this.sendEmailPaymentNotification(emailPayload, url)))
                        .then(() => this.showSuccessModal('Payment successful!', receiptUrls, receiptNames))
                        .catch(() => this.showSuccessModal('Payment successful!', receiptUrls, receiptNames));
                    return;
                }

                // ── 7. SUCCESS BUT NO RECEIPTS ────────────────────────
                this.restoreButton(otpButton);
                this.showErrorModal(
                    'Payment processed, but no receipts were generated. Please contact support.'
                );
            })
            .catch(error => {
                this.hideOverlay();
                this.restoreButton(otpButton);
                this.showErrorModal('OTP verification failed. Please try again.');
            });
    }

    // Show success modal with receipt links
    _showSuccessModal(message, urls) {
        this.removePopup("otp-popup")
        this.removePopup("payment-popup")

        const successPopup = document.createElement("div")
        successPopup.id = "success-popup"
        successPopup.style.position = "fixed"
        successPopup.style.top = "50%"
        successPopup.style.left = "50%"
        successPopup.style.transform = "translate(-50%, -50%)"
        successPopup.style.width = "90%"
        successPopup.style.maxWidth = "400px"
        successPopup.style.backgroundColor = "#fff"
        successPopup.style.border = "1px solid #e0e0e0"
        successPopup.style.borderRadius = "12px"
        successPopup.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"
        successPopup.style.zIndex = "1001"
        successPopup.style.padding = "24px"
        successPopup.style.fontFamily = "Arial, sans-serif"
        successPopup.style.textAlign = "center"
        successPopup.style.maxHeight = "90vh"
        successPopup.style.overflowY = "auto"

        let popupContent = `
        <div class="popup-header" style="text-align: center; margin-bottom: 20px;">
            <img src="${this.companyLogo}" alt="Company Logo" style="width: 100%; max-width: 250px;" />
        </div>
        <h3 style="color: green; font-size: 20px; margin-bottom: 10px;">${message}</h3>
        <p style="font-size: 14px; color: #444; margin-bottom: 25px;">Receipts Have Been Sent To Your Email</p>
        <div class="button-container" style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
    `

        // Add receipt download buttons
        if (Array.isArray(urls) && urls.length > 0) {
            const selectedItems = this.selectedItemsData || []

            urls.forEach((url, index) => {
                let buttonLabel = "Download Receipt"
                if (selectedItems.length > index) {
                    const item = selectedItems[index]
                    if (item && item.revName) {
                        buttonLabel = `Download Receipt - ${item.revName}`
                    } else {
                        buttonLabel = `Download Receipt ${index + 1}`
                    }
                } else {
                    buttonLabel = `Download Receipt ${index + 1}`
                }

                popupContent += `
                <button class="receipt-btn" data-url="${url}" style="
                    background-color: orange;
                    color: white;
                    padding: 12px;
                    font-size: 14px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    text-overflow: ellipsis;
                    overflow: hidden;
                    white-space: nowrap;
                    flex: 1 1 calc(50% - 12px);
                    min-width: 150px;
                    box-sizing: border-box;
                ">
                    <i class="fa fa-download" style="margin-right: 6px;"></i> ${buttonLabel}
                </button>
            `
            })
        } else if (urls) {
            popupContent += `
            <button id="download-receipt" style="
                background-color: orange;
                color: white;
                padding: 12px;
                font-size: 14px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                width: 100%;
            ">
                <i class="fa fa-download" style="margin-right: 6px;"></i> Download Receipt
            </button>
        `
        }

        // Replace this section in showSuccessModal (around line 1555-1575):

        popupContent += `
      <button id="close-success" style="
    background-color: #28a745;
    color: white;
    padding: 12px;
    font-size: 14px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    width: 100%;
    margin-top: 12px;
">
    <i class="fa fa-check-circle" style="margin-right: 6px;"></i> Continue >>
</button>
    </div>`

        successPopup.innerHTML = popupContent
        document.body.appendChild(successPopup)

        // Add event listeners for receipt buttons
        if (Array.isArray(urls) && urls.length > 0) {
            document.querySelectorAll(".receipt-btn").forEach((button) => {
                button.addEventListener("click", () => {
                    const url = button.getAttribute("data-url")
                    const anchor = document.createElement("a")
                    anchor.href = url
                    anchor.target = "_blank"
                    anchor.download = ""
                    document.body.appendChild(anchor)
                    anchor.click()
                    document.body.removeChild(anchor)
                })
            })
        } else if (urls) {
            document.getElementById("download-receipt").addEventListener("click", () => {
                const anchor = document.createElement("a")
                anchor.href = urls
                anchor.target = "_blank"
                anchor.download = ""
                document.body.appendChild(anchor)
                anchor.click()
                document.body.removeChild(anchor)
            })
        }
        // Store reference to 'this'
        const self = this;

        document.getElementById("close-success").addEventListener("click", function () {
            // alert("close-success");
            self.removePopup("success-popup");

            if (self.onSuccess) {
                self.onSuccess({
                    status: "success", amount: self.amount, transactionRef: self.transRef
                });
            }

            self.removePopup("payment-overlay");
            self.handleClose("PAYMENT_SUCCESSFUL");
        });

        // Add event listener for close button
        //document.getElementById("close-success").addEventListener("click", () => {
        //    this.removePopup("success-popup");

        //    if (this.onSuccess) {
        //        this.onSuccess({ status: "success", amount: this.amount });
        //    }

        //    this.removePopup("payment-overlay");

        //    window.location.href = "https://www.egolepay.com";
        //});
        //document.getElementById("close-success").addEventListener("click", () => {
        //    alert("close-success");
        //    this.removePopup("success-popup");

        //    if (this.onSuccess) {
        //        this.onSuccess({
        //            status: "success",
        //            amount: this.amount,
        //            transactionRef: this.transRef
        //            //harmonizedRefs: this.harmonizeRefs
        //        });
        //    }

        //    this.removePopup("payment-overlay");
        //    this.handleClose("PAYMENT_SUCCESSFUL");
        //});
    }

    // A notifylist entry carries its receipts in one merchantReturnUrl string.
    // When the payment produced several receipts the backend joins them with
    // "$$", so that delimiter is what decides how many download buttons the
    // success modal shows. The field can also hold a plain message instead of a
    // link ("Receipt unavailable, contact support."), which is dropped here.
    // Harmonized entries may read "link#Item name" (or "Item name#link"), so
    // an entry is kept when either side of the "#" is a URL. The name is left
    // attached here; the receipt splits it out (see _parseExternalReceipts).
    parseReceiptUrls(rawUrl) {
        if (!rawUrl || typeof rawUrl !== "string") return [];

        const isUrl = (v) => /^https?:\/\//i.test(v);
        const seen = new Set();
        const urls = [];
        rawUrl.split("$$").forEach((part) => {
            const entry = part.trim();
            if (!entry) return;
            const [a, b = ""] = entry.split("#", 2).map((x) => x.trim());
            const link = isUrl(a) ? a : isUrl(b) ? b : "";
            if (!link || seen.has(link)) return;   // de-dupe on the link alone
            seen.add(link);
            urls.push(entry);
        });
        return urls;
    }
    parseReceiptUrlsPrevious(value) {
        if (typeof value !== "string") return []

        return value
            .split("$$")
            .map((url) => url.trim())
            .filter((url) => /^https?:\/\//i.test(url))
    }

    // Builds the e-Receipt for a settled payment. `urls` are the agency
    // (LIRS) receipt links from merchantReturnUrl; harmonized bills carry the
    // purchased item's name after "#", webguid bills send a bare link.
    buildReceipt(status = "success", details = {}) {
        const ctx = this._receiptCtx || {}
        const { webGuid, type } = this.getQueryParams()
        const isHarmonized = (type || "").toLowerCase() === "harmonized"
        const items = Array.isArray(this.selectedItemsData) ? this.selectedItemsData : []
        const names = details.receiptNames || items.map((it) => it && it.revName).filter(Boolean)
        const externalReceipts = this._parseExternalReceipts(details.receiptUrls || [], names, "LIRS Receipt")
        const description = isHarmonized && items.length > 1
            ? `${items.length} items - ${ctx.agencyName || "Harmonized bill"}`
            : [ctx.revName, ctx.agencyName].filter(Boolean).join(" - ") || this.description || "Bill payment"
        let paidAt = details.paidAt ? new Date(details.paidAt) : new Date()
        if (isNaN(paidAt.getTime())) paidAt = new Date()
        const receipt = {
            merchantReference: webGuid || ctx.webGuid || this.txnRef || "",
            gatewayReference: this.transRef || ctx.pid || "",
            paymentReference: details.paymentReference || this.transRef || "",
            status,
            statusLabel: this._statusLabel(status),
            message: details.message || "",
            total: ctx.total || this.convertToNumber(this.amount) || 0,
            currency: this.currency || "NGN",
            description,
            channel: { card: "Card", transfer: "Bank Transfer", wallet: "Wallet" }[this.lastPaymentMethod] || "Web Platform",
            paidAt: paidAt.toISOString(),
            paidAtLabel: this._formatReceiptDate(paidAt),
            customer: { name: ctx.payerName || this.cardholder || "", email: this.email || "", phone: this.mobile || "" },
            merchantName: ctx.agencyName || "",
            card: null,
            bank: null,
            metadata: {},
            mode: /^sk_test_/.test(this.apiKey || "") ? "TEST" : "LIVE",
            issuer: "EgolePay",
            externalReceipts,
            externalReceiptsTitle: externalReceipts.length > 1 ? "LIRS Receipts" : "LIRS Receipt",
        }
        receipt.verificationCode = this._sealReceipt(receipt)
        return receipt
    }

    // Success screen: the shared EgolePay result modal with the e-Receipt
    // inline. The agency (LIRS) download buttons sit inside the receipt,
    // right after the total, one per receipt link.
    showSuccessModal(message, urls, names) {
        this.removePopup("otp-popup")
        this.removePopup("payment-popup")
        this.removePopup("success-popup")
        this.updateStep("success")

        const receiptUrls = Array.isArray(urls) ? urls : urls ? [urls] : []
        const receipt = this.buildReceipt("success", { receiptUrls, receiptNames: names || [] })
        this._lastReceiptUrls = receiptUrls

        this._mountResultModal({
            status: "success",
            title: "Payment successful",
            message: receipt.externalReceipts.length
                ? "Receipts have been sent to your email."
                : "No agency receipt is available for this payment.",
            receipt,
            onDone: () => this.handleSuccessClose(receiptUrls),
        })
    }

    // Method 1: Create the popup structure
    createSuccessPopup(message, urls) {
        const successPopup = document.createElement("div")
        successPopup.id = "success-popup"
        successPopup.className = "egp-center-modal"
        successPopup.style.position = "fixed"
        successPopup.style.top = "50%"
        successPopup.style.left = "50%"
        successPopup.style.transform = "translate(-50%, -50%)"
        successPopup.style.width = "90%"
        successPopup.style.maxWidth = "400px"
        successPopup.style.zIndex = "1003"
        successPopup.style.padding = "28px 26px"
        successPopup.style.textAlign = "center"
        successPopup.style.maxHeight = "92vh"
        successPopup.style.overflowY = "auto"

        // Only promise an email when a receipt actually exists to send.
        const hasReceipts = Array.isArray(urls) ? urls.length > 0 : Boolean(urls)
        const subtitle = hasReceipts
            ? "Receipts have been sent to your email"
            : "No receipt is available for this payment"

        let popupContent = `
        <div class="egp-modal-logo"><img src="${this.companyLogo}" alt="EgolePay" /></div>
        <div class="egp-success-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        <h3 style="color:#0f172a;font-size:19px;font-weight:700;margin:0 0 6px;">${message}</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 22px;">${subtitle}</p>
        <div class="button-container" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">
    `

        // Add receipt download buttons
        if (Array.isArray(urls) && urls.length > 0) {
            urls.forEach((url, index) => {
                // Keep labels short ("Receipt 1", "Receipt 2") so several buttons
                // sit side by side without the revenue name overflowing the modal.
                const buttonLabel = urls.length > 1 ? `Receipt ${index + 1}` : "Download Receipt"

                popupContent += `
                <button class="receipt-btn egp-btn egp-btn-primary" data-url="${url}" style="
                    text-overflow:ellipsis;overflow:hidden;white-space:nowrap;
                    flex:1 1 calc(50% - 10px);min-width:150px;
                ">${buttonLabel}</button>
            `
            })
        } else if (urls) {
            popupContent += `
            <button id="download-receipt" class="egp-btn egp-btn-primary">Download Receipt</button>
        `
        }

        popupContent += `
        <button id="close-success" class="egp-btn egp-btn-green" style="margin-top:12px;">Contine >> </button>
    </div>`

        successPopup.innerHTML = popupContent
        return successPopup
    }

    // Method 2: Attach event handlers using event delegation
    attachSuccessPopupHandlers(popup, urls) {
        // Use event delegation - single listener on the popup
        popup.addEventListener('click', (e) => {
            const target = e.target

            // Handle receipt button clicks
            if (target.classList.contains('receipt-btn') || target.id === 'download-receipt') {
                e.preventDefault()
                this.handleReceiptDownload(target.getAttribute('data-url') || urls)
            }

            // Handle Done button click (also check if click is on icon inside button)
            else if (target.id === 'close-success' || target.closest('#close-success')) {
                e.preventDefault()
                e.stopPropagation()
                this.handleSuccessClose(urls)
            }
        })
    }

    // Method 3: Handle receipt download
    //
    // The receipt PDF is served cross-origin (rg.ebs-rcm.com) with no CORS
    // headers, so it cannot be fetched into a blob to force a "real" download,
    // and the anchor `download` attribute is ignored for cross-origin URLs.
    // On desktop, opening a new tab renders the PDF (which the browser can then
    // save). Mobile webviews usually block new tabs entirely, so the button did
    // nothing; there we navigate the current view straight to the file, which
    // lets the host app's download handler (Android) or PDF viewer (iOS) take
    // over. This must run inside the click handler to count as a user gesture.
    handleReceiptDownload(url) {
        if (!url) return

        const isMobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "")

        if (isMobile) {
            // Mobile browsers and webviews download the PDF rather than rendering
            // it, so opening a new tab just leaves an empty tab behind once the
            // download starts. Trigger it through a same-context anchor click
            // instead: the download begins, the current page stays put, and no
            // blank tab is created. (The download attribute is ignored for this
            // cross-origin file but is harmless and hints a filename where honoured.)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = 'receipt.pdf'
            anchor.rel = 'noopener'
            document.body.appendChild(anchor)
            anchor.click()
            document.body.removeChild(anchor)
            return
        }

        // Desktop: open in a new tab so the PDF renders and can be saved from there.
        window.open(url, '_blank', 'noopener')
    }

    // Method 4: Handle success modal close
    handleSuccessClose(urls) {
        //alert("SuccessClose");
        //console.log("urls " + urls);
        // Optional: Show alert for debugging
        //alert("Payment completed successfully!")

        // Remove the success popup
        this.removePopup("success-popup")
        this._removeResultModal()
        this._releaseReceiptResources()

        // Call the onSuccess callback if it exists
        if (this.onSuccess && typeof this.onSuccess === 'function') {
            // Prepare success data
            const successData = {
                status: "success",
                message: "Payment completed successfully",
                amount: this.amount || (this._receiptCtx && this._receiptCtx.total) || 0,
                transactionRef: this.transRef,
                harmonizedRefs: this.txnRef,//this.harmonizeRefs || [],
                timestamp: new Date().toISOString(),
                paymentMethod: this.lastPaymentMethod || "card",
                receiptUrl: urls,
                receipts: (this._receipt && this._receipt.externalReceipts) || [],   // [{label,url}]
                receipt: this._receipt || null,
                itemsCount: this.selectedItemsData ? this.selectedItemsData.length : 1
            }

            this.onSuccess(successData)
        } else {
        }

        // Clean up overlay
        this.removePopup("payment-overlay")

        // Handle final close
        this.handleClose("PAYMENT_SUCCESSFUL")
    }

    // Send email payment notification
    emailPayment(data, receiptUrl) {
        this.showOverlay("Sending payment confirmation email, please wait...")

        const parsedDataValues = typeof data === "string" ? JSON.parse(data) : data

        const requestPayload = {
            product: "",
            email: parsedDataValues.email,
            maskPan: parsedDataValues.maskPan,
            amount: parsedDataValues.amountPaid,
            transReferenceNo: parsedDataValues.webGuid,
            userFullName: parsedDataValues.tellerName,
        }

        fetch(this.emailEndpoint, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: requestPayload,
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`)
                }
                return response.json()
            })
            .then((responseData) => {
                this.hideOverlay()
                this.showSuccessModal("Payment successful!. Click below to download the receipt.", receiptUrl)
            })
            .catch((error) => {
                this.hideOverlay()
                this.showSuccessModal("Payment successful!. Click below to download the receipt.", receiptUrl)
            })
    }

    // Send email payment notification (async version)
    async sendEmailPaymentNotification(data, receiptUrl) {
        data.receiptUrl = receiptUrl
        const endpoint = this.emailEndpoint

        // The email receipt is best-effort: the payment has already succeeded by
        // the time we get here, so a failure must never throw or block the flow.
        const showReceipt = () => {
            this.hideOverlay()
        }

        // A valid email is required by the endpoint. Sending an empty/invalid one
        // makes it return 500, so skip the call entirely in that case.
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const email = (data.email || "").trim()
        if (!emailRegex.test(email)) {
            showReceipt()
            return
        }
        data.email = email

        // Normalize amount to a plain numeric string (strip ₦, commas, spaces).
        if (data.amount != null) {
            data.amount = String(data.amount).replace(/[^\d.]/g, "")
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
            })

            if (response.ok) {
                await response.json().catch(() => null)
            }
        } catch (error) {
            // Swallow: notification is non-critical. Use debug so it doesn't show
            // as a red console error.

        } finally {
            showReceipt()
        }
    }

    // Mask card number for security
    maskCardNumber(cardNumber) {
        return cardNumber.replace(/.(?=.{4})/g, "*")
    }

    // Show transfer payment form
    // Fix for the showTransferForm function to properly handle the form content
    showTransferForm(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef) {
        this.lastPaymentMethod = "transfer"
        this.updateStep("transfer_payment_form");
        this.removePopup("error-modal")

        // Show loading state in the payment form area
        document.getElementById("payment-form").innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 300px;">
            <div style="text-align: center;">
                <div class="egp-spinner-lg"></div>
                <p style="margin-top: 20px; color: #666;">Loading transfer form...</p>
            </div>
        </div>
    `

        // Generate a unique transaction reference if not provided
        if (!transRef) {
            transRef = "EGPWP" + this.generateEGPRandomString()
        }

        // Call createTransferForm with proper parameters
        this.createTransferForm(webGuid, pid, amount, transRef, agencyName).then((formContent) => {
            // Update the payment form with the returned HTML content
            document.getElementById("payment-form").innerHTML = formContent

            // Add event listeners after the form is rendered
            const vpaynow = document.getElementById("vpay-now")
            const cancelvapaymentButton = document.getElementById("cancel-vapayment")
            const retryButton = document.getElementById("retry-transfer")

            if (cancelvapaymentButton) {
                // Cancel steps back to bill confirmation, it does not end checkout.
                // Same behaviour as the card form's Cancel, so backing out of one
                // payment method lets the payer pick the other.
                cancelvapaymentButton.addEventListener("click", () => {
                    this.removePopup("payment-popup")
                    this.getBillConfirmationPopup()
                })
            }

            if (vpaynow) {
                vpaynow.addEventListener("click", () => {
                    this.processBankPayment(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName)
                })
            }

            if (retryButton) {
                retryButton.addEventListener("click", () => {
                    this.showTransferForm(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName, transRef)
                })
            }
        })
    }

    // Add this validation function to your class
    validateTransferInputs_() {
        const vmobileInput = document.getElementById('vmobile');
        const vemailAlertInput = document.getElementById('vemailAlert');
        const vmobileError = document.getElementById('vmobile-error');
        const vemailAlertError = document.getElementById('vemailAlert-error');

        // Email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        // Phone validation regex (supports +234 format and 11 digit local format)
        const phoneRegex = /^(\+234[0-9]{10}|0[0-9]{10})$/;

        let isValid = true;

        // Validate phone
        const phoneValue = vmobileInput.value.trim();
        if (!phoneValue) {
            vmobileError.textContent = 'Phone number is required';
            vmobileInput.classList.add('error');
            vmobileInput.focus();
            isValid = false;
        } else if (!phoneRegex.test(phoneValue)) {
            vmobileError.textContent = 'Please enter a valid phone number (+234XXXXXXXXXX)';
            vmobileInput.classList.add('error');
            vmobileInput.focus();
            isValid = false;
        } else {
            vmobileError.textContent = '';
            vmobileInput.classList.remove('error');
        }

        // Validate email
        const emailValue = vemailAlertInput.value.trim();
        if (!emailValue) {
            vemailAlertError.textContent = 'Email is required';
            vemailAlertInput.classList.add('error');
            if (isValid) vemailAlertInput.focus(); // Focus only if phone was valid
            isValid = false;
        } else if (!emailRegex.test(emailValue)) {
            vemailAlertError.textContent = 'Please enter a valid email address';
            vemailAlertInput.classList.add('error');
            if (isValid) vemailAlertInput.focus();
            isValid = false;
        } else {
            vemailAlertError.textContent = '';
            vemailAlertInput.classList.remove('error');
        }

        return isValid;
    }

    createTransferFormPrevious(webGuid, pid, amount, transRef, authData, agencyName) {
        this.showOverlay("Processing, please wait...")

        const amountPaid = this.calculateOriginalAmount(amount, agencyName)

        const requestPayload = {
            apiKey: this.apiKey,//"sk_test_REVABC_QXZbHtF6m_oed1QFPAAAY4jFGP3-jyM-wjhgfdf87655678",
            email: "RevPay@gmail.com",
            amount: amountPaid,
            validityTime: "30",
            amountValidation: "A0",
            txnRef: webGuid,
            transRef: this.harmonizeRef,
            uIDNumber: "3494735302",
            cnt: this.selectedAddonCount || 1,
        }

        return fetch(this.vapaymentEndpoint, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestPayload),
        })
            .then((response) => {
                if (!response.ok) {
                    return response.json().then((errData) => {
                        throw new Error(errData.message || response.statusText)
                    })
                }
                return response.json()
            })
            .then((data) => {
                this.hideOverlay()
                if (data.StatusCode !== 200) {
                    throw new Error(data.OperationMessage)
                }

                const responseData = {
                    statusCode: data.StatusCode || 0,
                    operationMessage: data.OperationMessage || "",
                    bankName: data.BankName || "",
                    accountName: data.accountName || "",
                    accountNumber: data.AccountNumber || "",
                    transRef: this.harmonizeRef,
                    txnRef: data.TxnRef || "",
                    dateExpire: data.ExpiryDate || "",
                    validityTime: data.ExpiryTime || "",
                    amount: data.Amount ? Number.parseFloat(data.Amount).toFixed(2) : "0.00",
                }

                this.sourceAccount = responseData.accountNumber

                return `
    <div class="modern-transfer-form">
        <h3 class="egp-title">Bank Transfer</h3>
        <p class="egp-subtitle">Transfer the exact amount to the account below</p>

        <div>
            <label class="egp-label" for="vmobile">Phone Number</label>
            <input type="text" id="vmobile" name="vmobile" placeholder="+234XXXXXXXXXX" autocomplete="off" class="egp-input" style="margin-bottom:4px;">
            <span id="vmobile-error" class="egp-error-text"></span>
        </div>

        <div>
            <label class="egp-label" for="vemailAlert">Email</label>
            <input type="email" id="vemailAlert" name="vemailAlert" placeholder="example@email.com" autocomplete="off" class="egp-input" style="margin-bottom:4px;">
            <span id="vemailAlert-error" class="egp-error-text"></span>
        </div>

        <div class="egp-warn">Transfer the exact amount shown below</div>

        <div class="egp-bank-box">
            <div class="egp-bank-row">
                <span class="lbl">Bank Name</span>
                <span class="val" id="bank-name">${responseData.bankName}</span>
            </div>
            <div class="egp-bank-row">
                <span class="lbl">Account Number</span>
                <span class="val">
                    <span id="account-number">${responseData.accountNumber}</span>
                    <button type="button" class="egp-copy-btn" id="copy-account-number" title="Copy to clipboard">Copy</button>
                </span>
            </div>
            <div class="egp-bank-row">
                <span class="lbl">Account Name</span>
                <span class="val" id="account-name">${responseData.accountName}</span>
            </div>
            <div class="egp-bank-row">
                <span class="lbl">Amount</span>
                <span class="val accent" id="va-amount-details">\u20A6${Number.parseFloat(responseData.amount).toLocaleString()}</span>
            </div>
        </div>

        <div class="egp-bank-box">
            <div class="egp-bank-row">
                <span class="lbl">Expires In</span>
                <span class="val" id="vtexpiry">${responseData.validityTime}</span>
            </div>
            <div class="egp-bank-row">
                <span class="lbl">Expiry Date</span>
                <span class="val" id="vtexpirydate">${responseData.dateExpire}</span>
            </div>
        </div>

        <button class="egp-btn egp-btn-primary" type="button" id="vpay-now">I Have Paid</button>
        <button class="egp-btn egp-btn-secondary" type="button" id="cancel-vapayment">Cancel</button>
    </div>
`
            })
            .catch((error) => {
                this.hideOverlay()
                return `
        <div class="error-container" style="padding: 8px 0; text-align: center;">
            <h3 class="egp-title" style="color:#991b1b;">Error Loading Transfer Form</h3>
            <p class="egp-subtitle">${error.message || "Failed to load transfer form. Please try again."}</p>
            <button id="retry-transfer" class="egp-btn egp-btn-primary" style="margin-top:8px;">Retry</button>
        </div>
    `
            })
    }

    createTransferForm(webGuid, pid, amount, transRef, authData, agencyName) {
        this.showOverlay("Processing, please wait...")

        const amountPaid = this.calculateOriginalAmount(amount, agencyName)

        const requestPayload = {
            apiKey: "sk_test_REVABC_QXZbHtF6m_oed1QFPAAAY4jFGP3-jyM-wjhgfdf87655678",
            email: "RevPay@gmail.com",
            amount: amountPaid,
            validityTime: "30",
            amountValidation: "A0",
            txnRef: webGuid,
            transRef: this.harmonizeRef,
            uIDNumber: "3494735302",
            cnt: this.selectedAddonCount || 1,
        }

        return fetch(this.vapaymentEndpoint, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestPayload),
        })
            .then((response) => {
                if (!response.ok) {
                    return response.json().then((errData) => {
                        throw new Error(errData.message || response.statusText)
                    })
                }
                return response.json()
            })
            .then((data) => {
                this.hideOverlay()
                if (data.StatusCode !== 200) {
                    throw new Error(data.OperationMessage)
                }

                const responseData = {
                    statusCode: data.StatusCode || 0,
                    operationMessage: data.OperationMessage || "",
                    bankName: data.BankName || "",
                    accountName: data.accountName || "",
                    accountNumber: data.AccountNumber || "",
                    transRef: this.harmonizeRef,
                    txnRef: data.TxnRef || "",
                    dateExpire: data.ExpiryDate || "",
                    validityTime: data.ExpiryTime || "",
                    amount: data.Amount ? Number.parseFloat(data.Amount).toFixed(2) : "0.00",
                }

                this.sourceAccount = responseData.accountNumber

                return `
    <div class="modern-transfer-form">
        <h3 class="egp-title">Bank Transfer</h3>
        <p class="egp-subtitle">Transfer the exact amount to the account below</p>

        <div>
            <label class="egp-label" for="vemailAlert">Email</label>
            <input type="email" id="vemailAlert" name="vemailAlert" placeholder="example@email.com" value="${this.isGuest ? "" : this.escapeHtml(this.email)}" autocomplete="email" class="egp-input" style="margin-bottom:4px;">
            <span id="vemailAlert-error" class="egp-error-text"></span>
        </div>

        <div>
            <label class="egp-label" for="vmobile">Phone Number</label>
            <input type="tel" id="vmobile" name="vmobile" placeholder="+234XXXXXXXXXX or 0XXXXXXXXXX" value="${this.isGuest ? "" : this.escapeHtml(this.mobile)}" autocomplete="tel" class="egp-input" style="margin-bottom:4px;">
            <span id="vmobile-error" class="egp-error-text"></span>
        </div>

        <div class="egp-warn">Transfer the exact amount shown below</div>

        <div class="egp-bank-box">
            <div class="egp-bank-row">
                <span class="lbl">Bank Name</span>
                <span class="val" id="bank-name">${responseData.bankName}</span>
            </div>
            <div class="egp-bank-row">
                <span class="lbl">Account Number</span>
                <span class="val">
                    <span id="account-number">${responseData.accountNumber}</span>
                    <button type="button" class="egp-copy-btn" id="copy-account-number" title="Copy to clipboard">Copy</button>
                </span>
            </div>
            <div class="egp-bank-row">
                <span class="lbl">Account Name</span>
                <span class="val" id="account-name">${responseData.accountName}</span>
            </div>
            <div class="egp-bank-row">
                <span class="lbl">Amount</span>
                <span class="val accent" id="va-amount-details">\u20A6${Number.parseFloat(responseData.amount).toLocaleString()}</span>
            </div>
        </div>

        <div class="egp-bank-box">
            <div class="egp-bank-row">
                <span class="lbl">Expires In</span>
                <span class="val" id="vtexpiry">${responseData.validityTime}</span>
            </div>
            <div class="egp-bank-row">
                <span class="lbl">Expiry Date</span>
                <span class="val" id="vtexpirydate">${responseData.dateExpire}</span>
            </div>
        </div>

        <button class="egp-btn egp-btn-primary" type="button" id="vpay-now">I Have Paid</button>
        <button class="egp-btn egp-btn-secondary" type="button" id="cancel-vapayment">Cancel</button>
    </div>
`
            })
            .catch((error) => {
                this.hideOverlay()
                return `
        <div class="error-container" style="padding: 8px 0; text-align: center;">
            <h3 class="egp-title" style="color:#991b1b;">Error Loading Transfer Form</h3>
            <p class="egp-subtitle">${error.message || "Failed to load transfer form. Please try again."}</p>
            <button id="retry-transfer" class="egp-btn egp-btn-primary" style="margin-top:8px;">Retry</button>
        </div>
    `
            })
    }

    // Your processBankPayment - ADD VALIDATION AT THE START (no modals, just return early)
    processBankPaymentVerxid(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName) {
        //// VALIDATION FIRST - If validation fails, just return (no modal, inputs will show red)
        //if (!this.validateTransferInputs()) {
        //    return; // Stop execution silently - the red boxes are the user feedback
        //}

        // Validation passed, proceed with payment
        const mobile = this.mobile;//document.getElementById("vmobile")?.value
        const transRef = document.getElementById("account-number")?.innerHTML
        const amountToPay = document.getElementById("va-amount-details")?.innerHTML
        const emailAlert = this.email//document.getElementById("vemailAlert")?.value
        const { type } = this.getQueryParams()

        if (!this.validateEmail(emailAlert)) {
            this.showErrorModal("Please enter a valid email to get the payment receipt.")
            return
        }
        if (mobile == "") {
            this.showErrorModal("Please enter a valid phone number to get the payment receipt.")
            return
        }

        if (!amountToPay || !emailAlert) {
            this.showErrorModal("Please fill in all the fields.")
            return
        }

        this.showOverlay("Processing, please wait...")

        const requestPayload = {
            apiKey: "sk_test_VRXD_9fA3KQWm2E8LxR7HcD0PZB6JtN4YV5S1",
            paymentId: webGuid,
            otp: "",
            authData: "",
            email: emailAlert,
            description: "Bank Payment",
            ParentGUID: this.getParentGuid(),
            guidType: this.getGuidType(),
            allIsSelected: this.isAllItemsSelected(),
            transItem: [],
        }

        const selectedItems = this.selectedItemsData || []
        const isHarmonized = type?.toLowerCase() === "harmonized"
        const isWebGuid = type?.toLowerCase() === "webguid"

        if (isHarmonized && selectedItems.length > 0) {
            requestPayload.transItem = selectedItems.map((item) => ({
                apiKey: "sk_test_VRXD_9fA3KQWm2E8LxR7HcD0PZB6JtN4YV5S1",
                txnRef: item.webGuid || webGuid,
                paymentRef: this.harmonizeRef || transRef,
                paymentChannel: "Web Platform",
                channel: "Web Platform",
                creditAccount: item.creditAccount || creditAccount,
                bankNote: this.generateRandomString(8),
                tellerName: payerName,
                agencyCode: item.agencyCode,
                agencyName: item.agencyName,
                email: emailAlert,
                sourceAcct: this.sourceAccount,
                tnxAmount: String(item.amountDue),
            }))
        } else {
            const singleTxnRef = webGuid
            const singleAmount = isWebGuid ? this.calculateOriginalAmount(amountToPay) : amount

            requestPayload.transItem = [{
                apiKey: "sk_test_VRXD_9fA3KQWm2E8LxR7HcD0PZB6JtN4YV5S1",
                txnRef: singleTxnRef,
                paymentRef: this.harmonizeRef || transRef,
                paymentChannel: "Web Platform",
                channel: "Web Platform",
                creditAccount: creditAccount,
                bankNote: this.generateRandomString(8),
                tellerName: payerName,
                agencyCode: agencyName,
                agencyName: agencyName,
                email: emailAlert,
                sourceAcct: this.sourceAccount,
                tnxAmount: String(singleAmount),
            }]
        }

        // Exactly what goes on the wire to Verify, so guidType and allIsSelected
        // can be eyeballed against what the payer ticked.
        console.log("[EgolePay] Verify -> " + this.VerifypaymentEndpoint, {
            ParentGUID: requestPayload.ParentGUID,
            guidType: requestPayload.guidType,
            allIsSelected: requestPayload.allIsSelected,
            itemsSelected: this.selectedItemsData?.length || 0,
            itemsOnBill: this.totalBillItemCount ?? "(unknown)",
            payload: requestPayload,
        })
        console.log("[EgolePay] Verify body\n" + JSON.stringify(requestPayload, null, 2))

        fetch(this.VerifypaymentEndpoint, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestPayload),
        })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`)
                return response.json()
            })
            .then((data) => {
                this.hideOverlay()
                if ((data.statusCode === "00" || data.status === "00") && Array.isArray(data.notifylist) && data.notifylist.length > 0) {
                    const settledItems = data.notifylist.filter((item) => item.Status === "00" || item.statusCode === "00")

                    // merchantReturnUrl holds one receipt, or several joined by
                    // "$$" — the delimiter decides how many buttons are rendered.
                    const receiptEntries = []
                    const itemsWithReceipts = []

                    settledItems.forEach((item) => {
                        const urls = this.parseReceiptUrls(item.merchantReturnUrl)
                        if (urls.length === 0) return

                        itemsWithReceipts.push(item)
                        urls.forEach((url) => receiptEntries.push({ item, url }))
                    })

                    const failedCount = data.notifylist.length - itemsWithReceipts.length
                    const downloadLinks = receiptEntries.map((entry) => entry.url)
                    const revenueNames = receiptEntries.map((entry) => entry.item.revName || "Payment Receipt")

                    const sendEmailTasks = receiptEntries.map(({ item, url }) => {
                        const receiptUrl = url

                        //const emailPayload = {
                        //    product: "",
                        //    email: emailAlert,
                        //    maskPan: "",
                        //    amount: amountToPay,
                        //    transReferenceNo: Array.isArray(webGuid) ? webGuid[0] : webGuid,
                        //    userFullName: payerName,
                        //}

                        //return this.sendEmailPaymentNotification(emailPayload, receiptUrl)
                        //    .then(() => {
                        //    })
                        //    .catch((err) => {
                        //    })
                    })

                    Promise.all(sendEmailTasks).then(() => {
                        if (downloadLinks.length > 0) {
                            let successMessage = "Payment successful!"

                            if (failedCount > 0) {
                                successMessage = `Payment partially successful! ${itemsWithReceipts.length} item(s) processed successfully, ${failedCount} item(s) failed.`
                            }

                            this.showSuccessModal(successMessage, downloadLinks, revenueNames)
                        } else {
                            this.showNotifyErrorModal("Payment processed, but no valid receipts were generated. Please contact support.")
                        }
                    })
                } else if ((data.statusCode === "00" || data.status === "00") && data.merchantReturnUrl && data.status === "00") {
                    //const emailPayload = {
                    //    product: "",
                    //    email: emailAlert,
                    //    maskPan: "",
                    //    amount: amountToPay,
                    //    transReferenceNo: Array.isArray(webGuid) ? webGuid[0] : webGuid,
                    //    userFullName: payerName,
                    //}

                    //this.sendEmailPaymentNotification(emailPayload, data.merchantReturnUrl)
                    //    .then((response) => {
                    //        this.showSuccessModal("Payment successful!", data.merchantReturnUrl, [data.revName || "Payment Receipt"])
                    //    })
                    //    .catch((error) => {
                    const receiptUrls = this.parseReceiptUrls(data.merchantReturnUrl)

                    if (receiptUrls.length > 0) {
                        this.showSuccessModal("Payment successful!", receiptUrls, receiptUrls.map(() => data.revName || "Payment Receipt"))
                    } else {
                        this.showErrorModal("Payment processed, but no valid receipt was generated. Please contact support.")
                    }
                    //    })
                } else if (data.statusCode === "00" || data.status === "00") {
                    this.showErrorModal("Payment processed, but no valid receipt was generated. Please contact support.")
                } else {
                    const errorMessage = data.operationMessage || "Payment failed. Please try again."
                    this.showErrorModal(errorMessage)
                }
            })
            .catch((error) => {
                this.hideOverlay()
                this.showErrorModal("Payment failed. Please try again.")
            })
    }

    validateTransferInputs1() {
        // Get all required elements
        const mobile = this.mobile;//document.getElementById("vmobile");
        const accountNumber = document.getElementById("account-number");
        const amountDetails = document.getElementById("va-amount-details");
        const emailAlert = this.email;//document.getElementById("vemailAlert");

        let isValid = true;

        // Reset previous error states
        [mobile, accountNumber, amountDetails, emailAlert].forEach(element => {
            if (element) {
                element.style.border = "";
                element.classList.remove("input-error");
            }
        });

        // Validate mobile number
        if (mobile && (!mobile.value || mobile.value.trim() === "")) {
            mobile.style.border = "2px solid red";
            mobile.classList.add("input-error");
            isValid = false;
        } else if (mobile && mobile.value.trim() !== "") {
            // Optional: validate mobile format
            const mobileRegex = /^[0-9]{10,15}$/;
            if (!mobileRegex.test(mobile.value.replace(/[\s\-\(\)]/g, ''))) {
                mobile.style.border = "2px solid red";
                mobile.classList.add("input-error");
                isValid = false;
            }
        }

        // Validate account number
        if (accountNumber && (!accountNumber.innerHTML || accountNumber.innerHTML.trim() === "")) {
            accountNumber.style.border = "2px solid red";
            accountNumber.classList.add("input-error");
            isValid = false;
        }

        // Validate amount
        if (amountDetails && (!amountDetails.innerHTML || amountDetails.innerHTML.trim() === "")) {
            amountDetails.style.border = "2px solid red";
            amountDetails.classList.add("input-error");
            isValid = false;
        } else if (amountDetails && amountDetails.innerHTML.trim() !== "") {
            const amount = parseFloat(amountDetails.innerHTML.replace(/[^0-9.]/g, ''));
            if (isNaN(amount) || amount <= 0) {
                amountDetails.style.border = "2px solid red";
                amountDetails.classList.add("input-error");
                isValid = false;
            }
        }

        // Validate email (if required)
        if (emailAlert && emailAlert.value.trim() !== "") {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailAlert.value.trim())) {
                emailAlert.style.border = "2px solid red";
                emailAlert.classList.add("input-error");
                isValid = false;
            }
        }

        // Optional: Show error message
        if (!isValid) {

            // You can also show a toast or small error message
            // this.showToast("Please fill in all required fields correctly", "error");
        }

        return isValid;
    }

    processBankPayment(webGuid, pid, amount, payerName, creditAccount, cbnCode, revName, agencyName) {
        ////// VALIDATION FIRST - If validation fails, just return (no modal, inputs will show red)
        //if (!this.validateTransferInputs()) {
        //    return; // Stop execution silently - the red boxes are the user feedback
        //}

        // Prevent rapid successive calls
        if (this.isProcessingPayment) {

            return;
        }

        // Contact fields on the transfer form are required; errors show under each input.
        if (!this.validateTransferInputs_()) {
            return;
        }
        this.email = document.getElementById("vemailAlert").value.trim()
        this.mobile = document.getElementById("vmobile").value.trim()

        // Validation passed, proceed with payment
        const mobile = this.mobile//document.getElementById("vmobile")?.value
        const transRef = document.getElementById("account-number")?.innerHTML
        const amountToPay = document.getElementById("va-amount-details")?.innerHTML
        const emailAlert = this.email//document.getElementById("vemailAlert")?.value
        const { type } = this.getQueryParams()

        this.isProcessingPayment = true;

        if (!this.validateEmail(emailAlert)) {
            this.showErrorModal("Please enter a valid email to get the payment receipt.")
            return
        }

        //if (mobile == "") {
        //    this.showErrorModal("Please enter a valid phone number to get the payment receipt.")
        //    return
        //}

        if (!amountToPay || !emailAlert) {
            this.showErrorModal("Please fill in all the fields.")
            return
        }

        this.showOverlay("Processing, please wait...")

        const requestPayload = {
            apiKey: this.apiKey,//"sk_test_VRXD_9fA3KQWm2E8LxR7HcD0PZB6JtN4YV5S1",
            paymentId: webGuid,
            otp: "",
            authData: "",
            email: emailAlert,
            description: "Bank Payment",
            ParentGUID: this.getParentGuid(),
            guidType: this.getGuidType(),
            allIsSelected: this.isAllItemsSelected(),
            transItem: [],
        }

        const selectedItems = this.selectedItemsData || []
        const isHarmonized = type?.toLowerCase() === "harmonized"
        const isWebGuid = type?.toLowerCase() === "webguid"

        if (isHarmonized && selectedItems.length > 0) {
            requestPayload.transItem = selectedItems.map((item) => ({
                apiKey: this.apiKey,//"sk_test_VRXD_9fA3KQWm2E8LxR7HcD0PZB6JtN4YV5S1",
                txnRef: item.webGuid || webGuid,
                paymentRef: this.harmonizeRef || transRef,
                paymentChannel: "Web Platform",
                channel: "Web Platform",
                creditAccount: item.creditAccount || creditAccount,
                bankNote: this.generateRandomString(8),
                tellerName: payerName,
                agencyCode: item.agencyCode,
                agencyName: item.agencyName,
                email: emailAlert,
                sourceAcct: this.sourceAccount,
                tnxAmount: String(item.amountDue),
            }))
        } else {
            const singleTxnRef = webGuid
            const singleAmount = isWebGuid ? this.calculateOriginalAmount(amountToPay) : amount

            requestPayload.transItem = [{
                apiKey: this.apiKey,//"sk_test_VRXD_9fA3KQWm2E8LxR7HcD0PZB6JtN4YV5S1",
                txnRef: singleTxnRef,
                paymentRef: this.harmonizeRef || transRef,
                paymentChannel: "Web Platform",
                channel: "Web Platform",
                creditAccount: creditAccount,
                bankNote: this.generateRandomString(8),
                tellerName: payerName,
                agencyCode: agencyName,
                agencyName: agencyName,
                email: emailAlert,
                sourceAcct: this.sourceAccount,
                tnxAmount: String(singleAmount),
            }]
        }
        //    // ========== ADD LOGGING HERE ==========
        //    console.log("========== PROCESS BANK PAYMENT REQUEST ==========");
        //    console.log("Timestamp:", new Date().toISOString());
        //    console.log("Type:", type);
        //    console.log("Endpoint:", this.VerifypaymentEndpoint);
        //    console.log("Request Payload:", JSON.stringify(requestPayload, null, 2));
        //    console.log("Selected Items Count:", selectedItems.length);
        //    console.log("Is Harmonized:", isHarmonized);
        //    console.log("Is WebGuid:", isWebGuid);
        //    console.log("==================================================");
        //// =========================================
        // Exactly what goes on the wire to Verify, so guidType and allIsSelected
        // can be eyeballed against what the payer ticked.
        console.log("[EgolePay] Verify -> " + this.VerifypaymentEndpoint, {
            ParentGUID: requestPayload.ParentGUID,
            guidType: requestPayload.guidType,
            allIsSelected: requestPayload.allIsSelected,
            itemsSelected: this.selectedItemsData?.length || 0,
            itemsOnBill: this.totalBillItemCount ?? "(unknown)",
            payload: requestPayload,
        })
        console.log("[EgolePay] Verify body\n" + JSON.stringify(requestPayload, null, 2))

        // Execute payment verification with retry logic
        this.verifyPaymentWithRetry(requestPayload, 3)
            .then((data) => {
                this.isProcessingPayment = false;
                this.hideOverlay();
                this.handlePaymentResponse(data, emailAlert, amountToPay, webGuid, payerName);
            })
            .catch((error) => {
                this.isProcessingPayment = false;
                this.hideOverlay();

                // Different error messages based on error type
                if (error.message.includes("rate limit") || error.message.includes("Too many requests")) {
                    this.showErrorModal("Too many attempts. Please wait a moment and try again.");
                } else if (error.message.includes("timeout")) {
                    this.showErrorModal("Request timed out. Please check your connection and try again.");
                } else {
                    this.showErrorModal(error.message || "Payment failed. Please try again.");
                }
            });
    }

    async verifyPaymentWithRetry(payload, maxRetries = 3) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

                const response = await fetch(this.VerifypaymentEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                // Handle rate limiting
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
                    //console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                // Handle server errors with retry
                if (response.status >= 500 && response.status < 600) {
                    if (attempt < maxRetries) {
                        const waitTime = Math.pow(2, attempt) * 1000;
                        //console.warn(`Server error ${response.status}. Retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                }

                // Parse response body FIRST before checking status
                let text;
                let data;
                try {
                    text = await response.text();
                    data = JSON.parse(text);
                    //console.log(`Payment response (attempt ${attempt}):`, data);
                } catch (parseError) {
                    //console.error("Failed to parse response:", text);
                    throw new Error("Invalid response from payment server");
                }

                // NOW check if the response was successful (status code AND business status)
                if (!response.ok) {
                    // HTTP error - but still pass the parsed data for the caller to handle
                    const errorMessage = data?.message || data?.statusMessage || `HTTP error! Status: ${response.status}`;
                    throw new Error(errorMessage);
                }

                // Return the parsed data regardless of business status - let handlePaymentResponse decide
                return data;

            } catch (error) {
                lastError = error;

                // Don't retry on abort/timeout immediately
                if (error.name === 'AbortError') {
                    throw new Error("Request timed out. Please try again.");
                }

                // Log the error for debugging

                // If this was the last attempt, throw the error
                if (attempt === maxRetries) {
                    throw error;
                }

                // Wait before retrying (exponential backoff)
                const waitTime = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        throw lastError || new Error("Payment verification failed after all retries");
    }
    handlePaymentResponse(envelope, emailAlert, amountToPay, webGuid, payerName) {
        try {
            // ── 1. UNWRAP ENVELOPE ────────────────────────────────
            // Handles { Data: {...} } (PascalCase) and { data: {...} } (camelCase)
            const data = envelope?.Data ?? envelope?.data ?? envelope ?? {};

            // ── 2. NORMALIZE COMMON FIELDS ────────────────────────
            const statusCode = data.StatusCode ?? data.statusCode ?? null;
            const envelopeStatus = envelope.Status ?? envelope.status ?? null;
            const payloadStatus = data.Status ?? data.status ?? null;
            const notifyList = data.NotifyList ?? data.notifylist ?? [];
            const merchantReturnUrl = data.MerchantReturnUrl ?? data.merchantReturnUrl ?? null;
            const revName = data.revName ?? data.RevName ?? null;
            const operationMessage = data.operationMessage ?? data.OperationMessage ?? null;
            const envelopeMessage = envelope.Message ?? envelope.message ?? null;
            const dataMessage = data.Message ?? data.message ?? null;

            // ── 3. SUCCESS DETECTION ──────────────────────────────
            const isSuccess =
                envelopeStatus === true ||
                envelopeStatus === "true" ||
                statusCode === "00" ||
                payloadStatus === "00";

            // ── 4. FAILURE (early return) ─────────────────────────
            if (!isSuccess) {
                const errorMessage =
                    operationMessage ||
                    dataMessage ||
                    envelopeMessage ||
                    "Payment failed. Please try again.";
                this.showErrorModal(errorMessage);
                return;
            }

            // ── 5. CASE A: Multi-item notifyList ──────────────────
            if (Array.isArray(notifyList) && notifyList.length > 0) {

                const settledItems = notifyList.filter((item) => {
                    const itemStatus = item.Status ?? item.status ?? null;
                    const itemStatusCode = item.StatusCode ?? item.statusCode ?? null;
                    return itemStatus === "00" || itemStatusCode === "00";
                });

                const downloadLinks = [];
                const revenueNames = [];
                const itemsWithReceipts = [];

                settledItems.forEach((item) => {
                    const rawUrl = item.merchantReturnUrl ?? item.MerchantReturnUrl ?? "";
                    const urls = this.parseReceiptUrls(rawUrl);
                    if (urls.length === 0) return;

                    itemsWithReceipts.push(item);
                    urls.forEach((url) => {
                        downloadLinks.push(url);
                        revenueNames.push(item.revName ?? item.RevName ?? "Payment Receipt");
                    });
                });

                const failedCount = notifyList.length - itemsWithReceipts.length;

                Promise.resolve().then(() => {
                    if (downloadLinks.length > 0) {
                        let successMessage = "Payment successful!";
                        if (failedCount > 0) {
                            successMessage = `Payment partially successful! ${itemsWithReceipts.length} item(s) processed successfully, ${failedCount} item(s) failed.`;
                        }
                        this.showSuccessModal(successMessage, downloadLinks, revenueNames);
                    } else {
                        this.showNotifyErrorModal(
                            "Payment processed, but no valid receipts were generated. Please contact support."
                        );
                    }
                });

                return;
            }

            // ── 6. CASE B: Single receipt at payload level ────────
            if (merchantReturnUrl && this.parseReceiptUrls(merchantReturnUrl).length > 0) {
                const receiptUrls = this.parseReceiptUrls(merchantReturnUrl);
                this.showSuccessModal(
                    "Payment successful!",
                    receiptUrls,
                    receiptUrls.map(() => revName || "Payment Receipt")
                );
                return;
            }

            // ── 7. CASE C: Success but no receipts ────────────────
            this.showErrorModal(
                "Payment confirmed, but no valid receipt was generated. Please contact support."
            );
        } catch (error) {
            this.showErrorModal(
                "An unexpected error occurred while processing your payment. Please try again."
            );
        }
    }

    handlePaymentResponsePrevious(data, emailAlert, amountToPay, webGuid, payerName) {
        try {
            // Handle "Payment not found" or other non-00 status codes
            if (data.status !== "00" && data.statusCode !== "00") {
                const errorMessage = data.message || data.statusMessage || data.operationMessage || "Payment failed. Please try again.";
                this.showErrorModal(errorMessage);
                return;
            }

            // Handle successful response with notifylist (harmonized payments)
            if ((data.statusCode === "00" || data.status === "00") && Array.isArray(data.notifylist) && data.notifylist.length > 0) {
                const settledItems = data.notifylist.filter((item) =>
                    item.Status === "00" || item.statusCode === "00"
                );

                // merchantReturnUrl holds one receipt, or several joined by "$$" —
                // the delimiter decides how many buttons are rendered.
                const downloadLinks = [];
                const revenueNames = [];
                const itemsWithReceipts = [];

                settledItems.forEach((item) => {
                    const urls = this.parseReceiptUrls(item.merchantReturnUrl);
                    if (urls.length === 0) return;

                    itemsWithReceipts.push(item);
                    urls.forEach((url) => {
                        downloadLinks.push(url);
                        revenueNames.push(item.revName || "Payment Receipt");
                    });
                });

                const failedCount = data.notifylist.length - itemsWithReceipts.length;

                Promise.resolve().then(() => {
                    if (downloadLinks.length > 0) {
                        let successMessage = "Payment successful!";
                        if (failedCount > 0) {
                            successMessage = `Payment partially successful! ${itemsWithReceipts.length} item(s) processed successfully, ${failedCount} item(s) failed.`;
                        }
                        this.showSuccessModal(successMessage, downloadLinks, revenueNames);
                    } else {
                        this.showNotifyErrorModal("Payment processed, but no valid receipts were generated. Please contact support.");
                    }
                });

                // Handle successful single payment with merchant URL
            } else if ((data.statusCode === "00" || data.status === "00") && data.merchantReturnUrl && this.parseReceiptUrls(data.merchantReturnUrl).length > 0) {
                const receiptUrls = this.parseReceiptUrls(data.merchantReturnUrl);
                this.showSuccessModal("Payment successful!", receiptUrls, receiptUrls.map(() => data.revName || "Payment Receipt"));

                // Handle successful status but no receipt
            } else if (data.statusCode === "00" || data.status === "00") {
                this.showErrorModal("Payment confirmed, but no valid receipt was generated. Please contact support.");

                // Handle any other response
            } else {
                const errorMessage = data.operationMessage || data.message || "Payment failed. Please try again.";
                this.showErrorModal(errorMessage);
            }
        } catch (error) {

            this.showErrorModal("An unexpected error occurred while processing your payment. Please try again.");
        }
    }

    async _verifyPaymentWithRetry_(payload, maxRetries = 3) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

                const response = await fetch(this.VerifypaymentEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                // Handle rate limiting
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;

                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                // Handle server errors with retry
                if (response.status >= 500 && response.status < 600) {
                    if (attempt < maxRetries) {
                        const waitTime = Math.pow(2, attempt) * 1000;

                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                }

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                // Parse response - handle potential JSON parsing errors
                let text;
                try {
                    text = await response.text();
                    const data = JSON.parse(text);

                    // Log successful response for debugging
                    ////console.log(`Payment verification success on attempt ${attempt}:`, data);
                    return data;
                } catch (parseError) {

                    throw new Error("Invalid response from payment server");
                }

            } catch (error) {
                lastError = error;

                // Don't retry on abort/timeout immediately
                if (error.name === 'AbortError') {
                    throw new Error("Request timed out. Please try again.");
                }

                // Log the error for debugging

                // If this was the last attempt, throw the error
                if (attempt === maxRetries) {
                    throw error;
                }

                // Wait before retrying (exponential backoff)
                const waitTime = Math.pow(2, attempt) * 1000;
                ////console.log(`Retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        throw lastError || new Error("Payment verification failed after all retries");
    }

    _handlePaymentResponse_(data, emailAlert, amountToPay, webGuid, payerName) {
        try {
            // Handle successful response with notifylist (harmonized payments)
            if ((data.statusCode === "00" || data.status === "00") && Array.isArray(data.notifylist) && data.notifylist.length > 0) {
                const validReceipts = data.notifylist.filter((item) =>
                    (item.Status === "00" || item.statusCode === "00") &&
                    item.merchantReturnUrl &&
                    item.merchantReturnUrl.trim() !== ""
                );

                const failedCount = data.notifylist.length - validReceipts.length;
                const downloadLinks = [];
                const revenueNames = [];

                validReceipts.forEach((item) => {
                    downloadLinks.push(item.merchantReturnUrl);
                    revenueNames.push(item.revName || "Payment Receipt");
                });

                // Process email notifications (commented out, uncomment when ready)
                // const sendEmailTasks = validReceipts.map((item) => {
                //     const receiptUrl = item.merchantReturnUrl;
                //     const emailPayload = {
                //         product: "",
                //         email: emailAlert,
                //         maskPan: "",
                //         amount: amountToPay,
                //         transReferenceNo: Array.isArray(webGuid) ? webGuid[0] : webGuid,
                //         userFullName: payerName,
                //     };
                //     return this.sendEmailPaymentNotification(emailPayload, receiptUrl)
                //         .catch((err) => console.error("Email notification failed:", err));
                // });

                // For now, proceed without email notifications
                Promise.resolve().then(() => {
                    if (downloadLinks.length > 0) {
                        let successMessage = "Payment successful!";
                        if (failedCount > 0) {
                            successMessage = `Payment partially successful! ${downloadLinks.length} item(s) processed successfully, ${failedCount} item(s) failed.`;
                        }
                        this.showSuccessModal(successMessage, downloadLinks, revenueNames);
                    } else {
                        this.showNotifyErrorModal("Payment processed, but no valid receipts were generated. Please contact support.");
                    }
                });

                // Handle successful single payment with merchant URL
            } else if ((data.statusCode === "00" || data.status === "00") && data.merchantReturnUrl) {
                // Email sending commented out, uncomment when ready
                // const emailPayload = {
                //     product: "",
                //     email: emailAlert,
                //     maskPan: "",
                //     amount: amountToPay,
                //     transReferenceNo: Array.isArray(webGuid) ? webGuid[0] : webGuid,
                //     userFullName: payerName,
                // };
                // 
                // this.sendEmailPaymentNotification(emailPayload, data.merchantReturnUrl)
                //     .then(() => {
                //         this.showSuccessModal("Payment successful!", data.merchantReturnUrl, [data.revName || "Payment Receipt"]);
                //     })
                //     .catch((error) => {
                //         console.error("Email notification failed:", error);
                //         // Still show success even if email fails
                //         this.showSuccessModal("Payment successful!", data.merchantReturnUrl, [data.revName || "Payment Receipt"]);
                //     });

                // For now, show success directly
                this.showSuccessModal("Payment successful!", data.merchantReturnUrl, [data.revName || "Payment Receipt"]);

                // Handle successful status but no receipt
            } else if (data.statusCode === "00" || data.status === "00") {
                this.showErrorModal("Payment confirmed, but no valid receipt was generated. Please contact support.");

                // Handle error response
            } else {
                const errorMessage = data.operationMessage || data.message || "Payment failed. Please try again.";
                this.showErrorModal(errorMessage);
            }
        } catch (error) {

            this.showErrorModal("An unexpected error occurred while processing your payment. Please try again.");
        }
    }

    // Add these properties to your class constructor or initialization
    // this.isProcessingPayment = false;

    // 4. Setup event listeners - call this in your initialization
    setupTransferFormListeners() {
        // Clear errors when user starts typing
        document.addEventListener('input', (e) => {
            if (e.target && (e.target.id === 'vmobile' || e.target.id === 'vemailAlert')) {
                if (e.target.value.trim()) {
                    const errorElement = document.getElementById(e.target.id + '-error');
                    if (errorElement) {
                        errorElement.textContent = '';
                        e.target.classList.remove('error');
                    }
                }
            }
        });

        // Handle copy account number
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'copy-account-number') {
                const accountNumber = document.getElementById('account-number')?.textContent;
                if (accountNumber) {
                    navigator.clipboard.writeText(accountNumber).then(() => {
                        e.target.style.color = 'green';
                        setTimeout(() => {
                            e.target.style.color = 'black';
                        }, 1000);
                    }).catch(err => {
                    });
                }
            }
        });
    }

    // Show error modal
    showNotifyErrorModal(errorMessage) {
        this.removePopup("error-modal")

        const errorModal = document.createElement("div")
        errorModal.id = "error-modal"
        errorModal.className = "egp-center-modal"
        errorModal.style.position = "fixed"
        errorModal.style.top = "50%"
        errorModal.style.left = "50%"
        errorModal.style.transform = "translate(-50%, -50%)"
        errorModal.style.padding = "28px 26px"
        errorModal.style.zIndex = "1003"
        errorModal.style.textAlign = "center"
        errorModal.style.width = "90%"
        errorModal.style.maxWidth = "380px"

        errorModal.innerHTML = `
    <div style="width:52px;height:52px;background:#fee2e2;color:#991b1b;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:26px;font-weight:700;">!</div>
    <h3 class="egp-modal-title" style="margin-bottom:8px;">Something Went Wrong</h3>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.5;">${errorMessage}</p>
    <button id="close-error" class="egp-btn egp-btn-primary">Close</button>
  `

        document.body.appendChild(errorModal)

        document.getElementById("close-error").addEventListener("click", () => {
            this.removePopup("error-modal")
            this.removePopup("payment-overlay")

            // Call the onError callback if it exists
            if (this.onError && typeof this.onError === 'function') {
                // Prepare success data
                const errorData = {
                    status: "success",
                    message: "Payment Notification Error",
                    amount: this.amount,
                    transactionRef: this.transRef,
                    harmonizedRefs: this.harmonizeRefs || [],
                    timestamp: new Date().toISOString(),
                    paymentMethod: this.lastPaymentMethod || "card",
                    itemsCount: this.selectedItemsData ? this.selectedItemsData.length : 1
                }

                this.onError(errorData)
            } else {
            }

            // Clean up overlay
            this.removePopup("payment-overlay")
        })
    }

    // Show error modal
    showErrorModal(errorMessage) {
        this.removePopup("error-modal")

        const errorModal = document.createElement("div")
        errorModal.id = "error-modal"
        errorModal.className = "egp-center-modal"
        errorModal.style.position = "fixed"
        errorModal.style.top = "50%"
        errorModal.style.left = "50%"
        errorModal.style.transform = "translate(-50%, -50%)"
        errorModal.style.padding = "28px 26px"
        errorModal.style.zIndex = "1003"
        errorModal.style.textAlign = "center"
        errorModal.style.width = "90%"
        errorModal.style.maxWidth = "380px"

        errorModal.innerHTML = `
    <div style="width:52px;height:52px;background:#fee2e2;color:#991b1b;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:26px;font-weight:700;">!</div>
    <h3 class="egp-modal-title" style="margin-bottom:8px;">Something Went Wrong</h3>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.5;">${errorMessage}</p>
    <button id="close-error" class="egp-btn egp-btn-primary">Close</button>
  `

        document.body.appendChild(errorModal)

        document.getElementById("close-error").addEventListener("click", () => {
            this.removePopup("error-modal")
            this.removePopup("payment-overlay")
            location.reload()
        })
    }

    // Show error modal with different styling
    showErrModal(errorMessage) {
        this.removePopup("error-modal")

        const errorModal = document.createElement("div")
        errorModal.id = "error-modal"
        errorModal.className = "egp-center-modal"
        errorModal.style.position = "fixed"
        errorModal.style.top = "50%"
        errorModal.style.left = "50%"
        errorModal.style.transform = "translate(-50%, -50%)"
        errorModal.style.padding = "28px 26px"
        errorModal.style.zIndex = "1003"
        errorModal.style.textAlign = "center"
        errorModal.style.width = "90%"
        errorModal.style.maxWidth = "380px"

        errorModal.innerHTML = `
    <div style="width:52px;height:52px;background:#fee2e2;color:#991b1b;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:26px;font-weight:700;">!</div>
    <h3 class="egp-modal-title" style="margin-bottom:8px;">Oops!</h3>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.5;">${errorMessage}</p>
    <button id="close-error" class="egp-btn egp-btn-primary">Close</button>
  `

        document.body.appendChild(errorModal)

        document.getElementById("close-error").addEventListener("click", () => {
            this.removePopup("error-modal")
            this.removePopup("payment-overlay")
        })
    }

    // Show error modal with different styling
    showErrTypeModal(errorMessage) {
        this.removePopup("error-modal")

        const errorModal = document.createElement("div")
        errorModal.id = "error-modal"
        errorModal.className = "egp-center-modal"
        errorModal.style.position = "fixed"
        errorModal.style.top = "50%"
        errorModal.style.left = "50%"
        errorModal.style.transform = "translate(-50%, -50%)"
        errorModal.style.padding = "28px 26px"
        errorModal.style.zIndex = "1003"
        errorModal.style.textAlign = "center"
        errorModal.style.width = "90%"
        errorModal.style.maxWidth = "380px"

        errorModal.innerHTML = `
    <div style="width:52px;height:52px;background:#fee2e2;color:#991b1b;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:26px;font-weight:700;">!</div>
    <h3 class="egp-modal-title" style="margin-bottom:8px;">Oops!</h3>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.5;">${errorMessage}</p>
    <button id="close-error" class="egp-btn egp-btn-primary">Close</button>
  `

        document.body.appendChild(errorModal)

        const closeButton = document.getElementById("close-error")

        ////closeButton.addEventListener("click", () => {
        ////    this.removePopup("error-modal")
        ////    this.removePopup("payment-overlay")

        ////    // 🔥 Notify merchant instead of redirecting
        ////    this.onError({
        ////        message: errorMessage,
        ////        code: "SDK_VALIDATION_ERROR"
        ////    });

        ////    // Optional: redirect to home or any other logic
        ////    //this.redirectToHome() // Only call this if redirection is always required
        ////})
        closeButton.addEventListener("click", () => {
            this.removePopup("error-modal")
            this.removePopup("payment-overlay")

            // Notify merchant about the error
            this.onError({
                message: errorMessage, code: "SDK_VALIDATION_ERROR", step: this.currentStep
            });
        })
    }

    // Show amount error modal
    showAMTErrorModal(errorMessage, type) {
        this.removePopup("amterror-modal")

        const errorModal = document.createElement("div")
        errorModal.id = "amterror-modal"
        errorModal.className = "egp-center-modal"
        errorModal.style.position = "fixed"
        errorModal.style.top = "50%"
        errorModal.style.left = "50%"
        errorModal.style.transform = "translate(-50%, -50%)"
        errorModal.style.padding = "28px 26px"
        errorModal.style.zIndex = "1003"
        errorModal.style.textAlign = "center"
        errorModal.style.width = "90%"
        errorModal.style.maxWidth = "380px"

        errorModal.innerHTML = `
    <div style="width:52px;height:52px;background:#fee2e2;color:#991b1b;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:26px;font-weight:700;">!</div>
    <h3 class="egp-modal-title" style="margin-bottom:8px;">Error</h3>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.5;">${errorMessage}</p>
    <button id="close-error" class="egp-btn egp-btn-primary">Close</button>
  `

        document.body.appendChild(errorModal)

        document.getElementById("close-error").addEventListener("click", () => {
            this.removePopup("amterror-modal")
            location.reload()
        })
    }

    // Show processing overlay
    showOverlay(message) {
        const overlay = document.createElement("div")
        overlay.id = "processing-overlay"
        overlay.style.position = "fixed"
        overlay.style.top = "0"
        overlay.style.left = "0"
        overlay.style.width = "100%"
        overlay.style.height = "100%"
        overlay.style.backgroundColor = "rgba(15, 23, 42, 0.6)"
        overlay.style.zIndex = "1002"
        overlay.style.display = "flex"
        overlay.style.flexDirection = "column"
        overlay.style.justifyContent = "center"
        overlay.style.alignItems = "center"
        overlay.style.fontFamily = "'DM Sans', sans-serif"
        overlay.style.textAlign = "center"

        overlay.innerHTML = `
    <div style="background:#fff;padding:28px 32px;border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.2);">
      <div class="egp-spinner-lg"></div>
      <p style="margin:0;font-size:14px;font-weight:600;color:#475569;font-family:'DM Sans',sans-serif;">${message}</p>
    </div>
  `

        document.body.appendChild(overlay)
    }

    // Hide processing overlay
    hideOverlay() {
        const overlay = document.getElementById("processing-overlay")
        if (overlay) {
            overlay.remove()
        }
    }

    // Optional: Add a fallback method for unencrypted requests (for testing)
    verifyBillUnencrypted(webGuid, type) {
        return new Promise((resolve, reject) => {

            const requestPayload = {
                webGuid: webGuid, state: "XXSG", clientId: "869017180657232", tellerId: "2547624", type: type,
            }

            fetch(this.billVerificationEndpoint, {
                method: "POST", headers: {
                    "Content-Type": "application/json",
                }, body: JSON.stringify(requestPayload), // Send unencrypted payload
            })
                .then((response) => {
                    if (!response.ok) {
                        return response.json().then((errorData) => {
                            throw new Error(errorData?.statusMessage || "Unknown error occurred")
                        })
                    }
                    return response.json()
                })
                .then((data) => {
                    // ... same processing logic as encrypted version ...
                    resolve(data)
                })
                .catch((error) => {
                    reject(error)
                })
        })
    }

    destroy() {
        // Remove all popups
        this.removePopup("payment-popup");
        this.removePopup("otp-popup");
        this.removePopup("payment-overlay");
        this.removePopup("confirmbill-popup");
        this.removePopup("bill-validation-popup");
        this.removePopup("payment-options-popup");
        this.removePopup("error-modal");
        this.removePopup("success-popup");

        // Remove event listeners
        document.removeEventListener('keydown', this.handleEscKey);

        // Clear callbacks
        this.onSuccess = null;
        this.onCancel = null;
        this.onError = null;
        this.onClose = null;
        this.onStepChange = null;

    }

}

Object.assign(InlineJS.prototype, EgolePayReceipt);

// Cleanup method to properly destroy SDK

// Export the SDK
if (

    typeof
    module
    !==
    "undefined"
    &&
    module
        .exports
) {
    module
        .exports = InlineJS
} else {
    window.InlineJS = InlineJS
}
