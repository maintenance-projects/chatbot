document.addEventListener("DOMContentLoaded", () => {
    const shell = document.getElementById("cbShell");
    const widget = document.getElementById("cbWidget");
    const body = document.getElementById("cbBody");
    const input = document.getElementById("cbInput");
    const sendBtn = document.getElementById("cbSend");
    const inputWrap = document.getElementById("cbInputWrap");

    const viewer = document.getElementById("cbViewer");
    const viewerFrame = document.getElementById("cbViewerFrame");
    const viewerClose = document.getElementById("cbViewerClose");

    if (!body || !input || !sendBtn || !inputWrap) return;

    let chipRow = document.getElementById("cbChipRow");
    if (!chipRow) {
        chipRow = document.createElement("div");
        chipRow.className = "cb-chiprow";
        chipRow.id = "cbChipRow";
        chipRow.setAttribute("aria-hidden", "true");
        inputWrap.appendChild(chipRow);
    }

    const defaultPlaceholder = (input.getAttribute("placeholder") || input.placeholder || "").trim();

    const plusBtn = document.getElementById("cbPlus");
    const pop = document.getElementById("cbPop");
    const actionUpload = document.getElementById("cbActionUpload");
    const actionPrint = document.getElementById("cbActionPrint");
    const actionSelect = document.getElementById("cbActionSelect");
    const actionUpResearch = document.getElementById("cbActionUpResearch");
    const fileInput = document.getElementById("cbFileInput");
    const tplFileInput = document.getElementById("cbTplFileInput");

    const guideBtn = document.getElementById("cbGuideBtn");
    const guideModal = document.getElementById("cbGuideModal");
    const guideClose = document.getElementById("cbGuideClose");

    const tray = document.getElementById("cbTplTray");
    const trayClose = document.getElementById("cbTplTrayClose");
    const trayBody = document.getElementById("cbTplTrayBody");

    const docsBtn = document.getElementById("cbDocsBtn");

    /* ── 번역 선택 (translate chip) ── */
    let selectedTranslate = null; // e.g. "en", "ja", "zh" or null
    let translateTag = null;

    const langBtn = document.getElementById("cbLangBtn");
    const langDropdown = document.getElementById("cbLangDropdown");

    function ensureTranslateTag() {
        if (translateTag) return translateTag;
        translateTag = document.createElement("button");
        translateTag.type = "button";
        translateTag.id = "cbTranslateTag";
        translateTag.setAttribute("aria-pressed", "false");
        translateTag.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" class="cb-tag__icon" style="flex-shrink:0">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      </svg>
      <span class="cb-transtag__label"></span>
      <span class="cb-transtag__x" aria-hidden="true">×</span>
    `;
        translateTag.addEventListener("click", (e) => {
            e.preventDefault();
            setTranslate(null);
            input.focus();
        });
        mountChip(translateTag);
        translateTag.style.display = "none";
        updateChipRow();
        return translateTag;
    }

    function setTranslate(code) {
        selectedTranslate = code || null;
        const tag = ensureTranslateTag();
        if (!tag) return;
        if (!selectedTranslate) {
            tag.style.display = "none";
            tag.setAttribute("aria-pressed", "false");
            const labelEl = tag.querySelector(".cb-transtag__label");
            if (labelEl) labelEl.textContent = "";
    
            updateChipRow();
            return;
        }
        tag.style.display = "";
        tag.setAttribute("aria-pressed", "true");
        const labelEl = tag.querySelector(".cb-transtag__label");
        if (labelEl) labelEl.textContent = TRANSLATE.getLabel(selectedTranslate);

        updateChipRow();
    }



    if (langBtn && langDropdown) {
        function updateLangDropdown() {
            langDropdown.querySelectorAll("li").forEach(li => {
                li.classList.toggle("is-active", li.getAttribute("data-lang") === selectedTranslate);
            });
        }

        langBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const open = langDropdown.classList.toggle("is-open");
            langBtn.setAttribute("aria-expanded", open ? "true" : "false");
            langDropdown.setAttribute("aria-hidden", open ? "false" : "true");
            updateLangDropdown();
        });

        langDropdown.addEventListener("click", (e) => {
            const li = e.target.closest("li[data-lang]");
            if (!li) return;
            const code = li.getAttribute("data-lang");
            setTranslate(selectedTranslate === code ? null : code);
            updateLangDropdown();
            langDropdown.classList.remove("is-open");
            langBtn.setAttribute("aria-expanded", "false");
            langDropdown.setAttribute("aria-hidden", "true");
        });

        document.addEventListener("click", (e) => {
            if (!langBtn.contains(e.target) && !langDropdown.contains(e.target)) {
                langDropdown.classList.remove("is-open");
                langBtn.setAttribute("aria-expanded", "false");
                langDropdown.setAttribute("aria-hidden", "true");
            }
        });
    }
    /* ── end 번역 선택 ── */

    const documentListPopup = document.createElement("div");
    documentListPopup.className = "document-list-popup";
    documentListPopup.style.display = "none";
    documentListPopup.setAttribute("aria-hidden", "true");
    inputWrap.appendChild(documentListPopup);

    const sessionId = window.sessionId || "";

    let isResearchMode = false;
    let researchTag = null;

    let selectedTemplate = null;
    let templateTag = null;
    let templateAttachBtn = null;
    let selectedTemplateFile = null;
    let templateFileTag = null;

    let selectedDocument = null;
    let documentTag = null;

    let continueNext = false;
    let continueThreadId = null;

    const MAX_HEIGHT = 250;

    let uploadedFilesCache = null;
    let uploadedFilesPromise = null;

    let summaryBusy = false;

    let activeViewerBlobUrl = null;

    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function escapeHtml(str) {
        return String(str)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function renderRichText(raw) {
        const esc = escapeHtml(raw || "");
        return esc.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
    }

    function normalizeBubbleText(text) {
        let s = String(text ?? "");
        s = s.replace(/\r\n/g, "\n");
        s = s.replace(/^[ \t]*\n+/, "");
        return s;
    }

    function formatTime(d) {
        const h = d.getHours();
        const m = d.getMinutes();
        const ampm = h < 12 ? "오전" : "오후";
        const hh = h % 12 === 0 ? 12 : h % 12;
        return `${ampm} ${hh}:${pad2(m)}`;
    }

    function scrollToBottom() {
        body.scrollTop = body.scrollHeight;
    }

    function autoResizeInput() {
        input.style.height = "auto";
        const nextHeight = Math.min(input.scrollHeight, MAX_HEIGHT);
        input.style.height = `${nextHeight}px`;
        if (input.scrollHeight > MAX_HEIGHT) input.style.overflowY = "auto";
        else input.style.overflowY = "hidden";
    }

    function getExt(name) {
        const n = (name || "").toLowerCase().trim();
        const i = n.lastIndexOf(".");
        if (i < 0) return "";
        return n.slice(i + 1);
    }

    function isAllowedFile(file) {
        if (!file) return false;
        if (!file.name) return false;
        return true;
    }

    function safeEncodePathSegment(value) {
        const s = String(value ?? "").trim();
        if (!s) return "";
        try {
            return encodeURIComponent(decodeURIComponent(s));
        } catch (e) {
            return encodeURIComponent(s);
        }
    }

    function withCacheBuster(absUrl) {
        try {
            const u = new URL(String(absUrl), window.location.href);
            const hash = u.hash || "";
            u.hash = "";
            u.searchParams.set("_v", String(Date.now()));
            return u.toString() + hash;
        } catch (e) {
            const raw = String(absUrl);
            const parts = raw.split("#");
            const base = parts[0] || "";
            const hash = parts.length > 1 ? `#${parts.slice(1).join("#")}` : "";
            const sep = base.includes("?") ? "&" : "?";
            return `${base}${sep}_v=${Date.now()}${hash}`;
        }
    }

    function setViewerTitle(text) {
        if (!viewer) return;
        const t = viewer.querySelector(".cb-viewer__title");
        if (t) t.textContent = String(text || "");
    }

    function isDesktopViewerMode() {
        try {
            return window.matchMedia && window.matchMedia("(min-width: 901px)").matches;
        } catch (e) {
            return false;
        }
    }

    function splitHash(url) {
        const raw = String(url || "");
        const i = raw.indexOf("#");
        if (i < 0) return { base: raw, hash: "" };
        return { base: raw.slice(0, i), hash: raw.slice(i) };
    }

    function revokeViewerBlob() {
        if (!activeViewerBlobUrl) return;
        try {
            const i = activeViewerBlobUrl.indexOf("#");
            const base = i >= 0 ? activeViewerBlobUrl.slice(0, i) : activeViewerBlobUrl;
            URL.revokeObjectURL(base);
        } catch (e) { }
        activeViewerBlobUrl = null;
    }

    async function openViewer(url, title) {
        if (!url) return;

        const desktop = isDesktopViewerMode();

        if (desktop && shell && viewer && viewerFrame) {
            shell.classList.add("has-viewer");
            viewer.classList.add("is-open");
            viewer.setAttribute("aria-hidden", "false");

            setViewerTitle(title || "미리보기");

            viewerFrame.src = "about:blank";

            try { viewerFrame.removeAttribute("srcdoc"); } catch (e) { }

            revokeViewerBlob();

            viewerFrame.src = withCacheBuster(url);

            scrollToBottom();
            return;
        }

        window.open(url, "_blank", "noopener");
    }

    function closeViewer() {
        if (!shell || !viewer || !viewerFrame) return;
        shell.classList.remove("has-viewer");
        viewer.classList.remove("is-open");
        viewer.setAttribute("aria-hidden", "true");

        try { viewerFrame.removeAttribute("srcdoc"); } catch (e) { }

        viewerFrame.src = "about:blank";
        revokeViewerBlob();
    }

    if (viewerClose) {
        viewerClose.addEventListener("click", (e) => {
            e.preventDefault();
            closeViewer();
        });
    }

    function actionsHtml(opts) {
        const canCopy = !!(opts && opts.copy);
        const downloadUrl = opts && opts.downloadUrl ? String(opts.downloadUrl) : "";
        const showView = !!(opts && opts.view);
        const viewUrl = opts && opts.viewUrl ? String(opts.viewUrl) : "";
        const viewExt = opts && opts.viewExt ? String(opts.viewExt) : "";
        const viewName = opts && opts.viewName ? String(opts.viewName) : "";

        if (!canCopy && !downloadUrl && !showView) return "";

        let html = `<div class="cb-actionsbar" aria-hidden="true">`;
        if (canCopy) {
            html += `
        <button class="cb-actbtn cb-actbtn--copy" type="button" aria-label="복사" data-tooltip="복사">
          <img src="/img/ic-copy.png" alt="복사" />
        </button>
      `;
        }
        if (downloadUrl) {
            html += `
        <button class="cb-actbtn cb-actbtn--download" type="button" aria-label="다운로드" data-url="${escapeHtml(downloadUrl)}" data-tooltip="다운로드">
          <img src="/img/ic-view-down.svg" alt="다운로드" />
        </button>
      `;
        }
        if (showView) {
            html += `
        <button class="cb-actbtn cb-actbtn--view" type="button" aria-label="미리보기" data-url="${escapeHtml(viewUrl)}" data-ext="${escapeHtml(viewExt)}" data-name="${escapeHtml(viewName)}" data-tooltip="미리보기">
          <img src="/img/ic-view.svg" alt="미리보기" />
        </button>
      `;
        }
        html += `</div>`;
        return html;
    }

    function fileQuickActionsHtml(disabled) {
        const dis = disabled ? ` disabled` : ``;
        return `
      <div class="cb-fileqbar" aria-hidden="true">
        <button type="button" class="cb-fileqbtn" data-action="summary"${dis}>요약</button>
        <button type="button" class="cb-fileqbtn" data-action="question"${dis}>질문</button>
      </div>
    `;
    }

    async function copyToClipboard(text) {
        const t = String(text ?? "");
        if (!t.trim()) return false;

        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                await navigator.clipboard.writeText(t);
                return true;
            }
        } catch (e) { }

        try {
            const ta = document.createElement("textarea");
            ta.value = t;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            ta.style.top = "0";
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand("copy");
            ta.remove();
            return !!ok;
        } catch (e) {
            return false;
        }
    }

    function getCopyTextFromMsg(msgEl) {
        if (!msgEl) return "";
        const direct = msgEl.getAttribute("data-copytext");
        if (direct != null) return String(direct || "");

        const pre = msgEl.querySelector(".cb-bubble__text pre[data-rawtext]");
        if (pre) return pre.getAttribute("data-rawtext") || "";

        const bubbleText = msgEl.querySelector(".cb-bubble__text");
        if (bubbleText) return bubbleText.innerText || bubbleText.textContent || "";

        return msgEl.innerText || "";
    }

    function endUserCardStack() {
        const last = body.lastElementChild;
        if (last && last.classList && last.classList.contains("cb-cardstack") && last.getAttribute("data-kind") === "user") {
            last.classList.add("is-closed");
        }
    }

    function ensureUserCardStack() {
        const last = body.lastElementChild;
        if (last && last.classList && last.classList.contains("cb-cardstack") && last.getAttribute("data-kind") === "user" && !last.classList.contains("is-closed")) {
            return last;
        }
        const stack = document.createElement("div");
        stack.className = "cb-cardstack cb-cardstack--user";
        stack.setAttribute("data-kind", "user");
        body.appendChild(stack);
        return stack;
    }

    function addUserMessage(text, translateTo) {
        endUserCardStack();
        const now = formatTime(new Date());
        const raw = String(text ?? "");
        const transBadge = translateTo
            ? `<div class="cb-translate-badge">${escapeHtml(TRANSLATE.getLabel(translateTo))} 번역</div>`
            : "";
        const html = `
      <div class="cb-msg cb-msg--user">
        <div class="cb-bubble">
          ${transBadge}
          <div class="cb-bubble__text">
            <pre data-rawtext="${escapeHtml(raw)}">${escapeHtml(raw)}</pre>
          </div>
          <div class="cb-meta">${now}</div>
          ${actionsHtml({ copy: true })}
        </div>
      </div>
    `;
        body.insertAdjacentHTML("beforeend", html);
        scrollToBottom();
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
    }

    function addUserFileMessageWithProgress(file) {
        const name = file && file.name ? String(file.name) : "파일";
        const ext = getExt(name);
        const badge = ext ? ext.toUpperCase() : "FILE";
        const id = `cbUpload_${Date.now()}_${Math.random().toString(16).slice(2)}`;

        const html = `
      <div class="cb-msg cb-msg--user cb-msg--card cb-msg--upload-progress" data-upload-id="${id}" data-copytext="${escapeHtml(name)}" data-filename="${escapeHtml(name)}" data-upload-done="false">
        <div class="cb-bubble cb-bubble--card">
          <div class="cb-bubble__text">
            <div class="cb-upload-card">
              <div class="cb-upload-card__header">
                <img src="/img/ic-file-w.png" class="cb-upload-card__icon" alt="" />
                <div class="cb-upload-card__meta_w">
                  <div class="cb-upload-card__name">${escapeHtml(name)}</div>
                  <div class="cb-upload-card__badge">${escapeHtml(badge)}</div>
                </div>
              </div>

              <div class="cb-upload-status">업로드 준비 중...</div>

              <div class="cb-upload-progress-wrap">
                <div class="cb-upload-progress-bar">
                  <div class="cb-upload-progress-fill" style="width: 0%"></div>
                </div>
                <div class="cb-upload-progress-text">0%</div>
              </div>
            </div>
          </div>
          ${fileQuickActionsHtml(true)}
          ${actionsHtml({ copy: false })}
        </div>
      </div>
    `;
        const stack = ensureUserCardStack();
        stack.insertAdjacentHTML("beforeend", html);

        const msgEl = body.querySelector(`.cb-msg[data-upload-id="${id}"]`);
        const progressFill = msgEl ? msgEl.querySelector(".cb-upload-progress-fill") : null;
        const progressText = msgEl ? msgEl.querySelector(".cb-upload-progress-text") : null;
        const statusText = msgEl ? msgEl.querySelector(".cb-upload-status") : null;

        scrollToBottom();

        return { msgEl, progressFill, progressText, statusText, id };
    }

    function updateUploadProgress(handle, percent, message) {
        if (!handle) return;

        const p = Math.max(0, Math.min(100, Number(percent) || 0));
        handle._lastPercent = p;

        if (handle.progressFill) handle.progressFill.style.width = `${p}%`;
        if (handle.progressText) handle.progressText.textContent = `${Math.round(p)}%`;

        const m = String(message || "").trim();
        if (handle.statusText && m) handle.statusText.textContent = m;

        scrollToBottom();
    }

    function finalizeUploadProgress(handle) {
        if (!handle || !handle.msgEl) return;

        handle.msgEl.classList.remove("cb-msg--upload-progress");
        handle.msgEl.setAttribute("data-upload-done", "true");

        const qbar = handle.msgEl.querySelector(".cb-fileqbar");
        if (qbar) {
            const btns = Array.from(qbar.querySelectorAll(".cb-fileqbtn"));
            btns.forEach((b) => b.removeAttribute("disabled"));
        }

        const progressWrap = handle.msgEl.querySelector(".cb-upload-progress-wrap");
        if (progressWrap) progressWrap.remove();

        const uploadCard = handle.msgEl.querySelector(".cb-upload-card");
        if (uploadCard) uploadCard.classList.add("cb-upload-card--complete");

        const status = handle.msgEl.querySelector(".cb-upload-status");
        if (status && !status.textContent.trim()) status.textContent = "업로드 완료";
    }

    function addUserDocMessageByName(name) {
        const filename = String(name || "파일");
        const ext = getExt(filename);
        const badge = ext ? ext.toUpperCase() : "FILE";

        const html = `
      <div class="cb-msg cb-msg--user cb-msg--card" data-copytext="${escapeHtml(filename)}" data-filename="${escapeHtml(filename)}">
        <div class="cb-bubble cb-bubble--card">
          <div class="cb-bubble__text">
            <div class="cb-filecard" role="group" aria-label="첨부파일">
              <img src="/img/ic-file-w.png" class="cb-filecard__icon" alt="" />
              <div class="cb-filecard__meta_w">
                <div class="cb-filecard__name">${escapeHtml(filename)}</div>
                <div class="cb-filecard__badge">${escapeHtml(badge)}</div>
              </div>
            </div>
          </div>
          ${fileQuickActionsHtml(false)}
          ${actionsHtml({ copy: false })}
        </div>
      </div>
    `;
        const stack = ensureUserCardStack();
        stack.insertAdjacentHTML("beforeend", html);
        scrollToBottom();
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
    }

    function addUserTemplateMessage(tpl) {
        const name = tpl && tpl.name ? String(tpl.name) : "양식";

        const html = `
      <div class="cb-msg cb-msg--user cb-msg--card" data-copytext="${escapeHtml(name)}">
        <div class="cb-bubble cb-bubble--card">
          <div class="cb-bubble__text">
            <div class="cb-filecard" role="group" aria-label="양식 선택">
              <img src="/img/ic-select-w.png" class="cb-filecard__icon" alt="" />
              <div class="cb-filecard__meta_w">
                <div class="cb-filecard__name">${escapeHtml(name)}</div>
                <div class="cb-filecard__badge">${escapeHtml("양식")}</div>
              </div>
            </div>
          </div>
          ${actionsHtml({ copy: false })}
        </div>
      </div>
    `;
        const stack = ensureUserCardStack();
        stack.insertAdjacentHTML("beforeend", html);
        scrollToBottom();
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
    }

    function addUserTemplateWithFileMessage(tpl, file) {
        const name = tpl && tpl.name ? String(tpl.name) : "양식";
        const fname = file && file.name ? String(file.name) : "";
        const ext = getExt(fname);
        const badge = ext ? ext.toUpperCase() : "FILE";
        const id = `cbUpload_${Date.now()}_${Math.random().toString(16).slice(2)}`;

        const html = `
      <div class="cb-msg cb-msg--user cb-msg--card cb-msg--upload-progress" data-upload-id="${id}" data-copytext="${escapeHtml(name + (fname ? " / " + fname : ""))}" data-filename="${escapeHtml(fname)}" data-upload-done="false">
        <div class="cb-bubble cb-bubble--card">
          <div class="cb-bubble__text">
            <div class="cb-filecard" role="group" aria-label="양식 선택">
              <img src="/img/ic-select-w.png" class="cb-filecard__icon" alt="" />
              <div class="cb-filecard__meta_w">
                <div class="cb-filecard__name">${escapeHtml(name)}</div>
                <div class="cb-filecard__badge">${escapeHtml("양식")}</div>
              </div>
            </div>
            ${fname ? `<div class="cb-tplfile-attach">
              <span class="cb-tplfile-attach__name">${escapeHtml(fname)}</span>
              <span class="cb-tplfile-attach__badge">${escapeHtml(badge)}</span>
            </div>` : ""}
            <div class="cb-upload-status">업로드 준비 중...</div>
            <div class="cb-upload-progress-wrap">
              <div class="cb-upload-progress-bar">
                <div class="cb-upload-progress-fill" style="width: 0%"></div>
              </div>
              <div class="cb-upload-progress-text">0%</div>
            </div>
          </div>
          ${actionsHtml({ copy: false })}
        </div>
      </div>
    `;
        const stack = ensureUserCardStack();
        stack.insertAdjacentHTML("beforeend", html);

        const msgEl = body.querySelector(`.cb-msg[data-upload-id="${id}"]`);
        const progressFill = msgEl ? msgEl.querySelector(".cb-upload-progress-fill") : null;
        const progressText = msgEl ? msgEl.querySelector(".cb-upload-progress-text") : null;
        const statusText = msgEl ? msgEl.querySelector(".cb-upload-status") : null;

        scrollToBottom();
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);

        return { msgEl, progressFill, progressText, statusText, id };
    }

    function addBotMessage(text) {
        endUserCardStack();
        const now = formatTime(new Date());
        const clean = normalizeBubbleText(text);

        const html = `
      <div class="cb-msg cb-msg--bot">
        <div class="cb-bubble">
          <div class="cb-bubble__text">
            <pre data-rawtext="${escapeHtml(clean)}">${renderRichText(clean)}</pre>
          </div>
          <div class="cb-meta">${now}</div>
          ${actionsHtml({ copy: true })}
        </div>
      </div>
    `;
        body.insertAdjacentHTML("beforeend", html);
        scrollToBottom();
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
    }

    function normalizePageValue(p) {
        if (p == null) return null;
        const s = String(p).trim();
        if (!s) return null;
        const n = Number(s);
        if (!Number.isFinite(n) || n <= 0) return null;
        return Math.floor(n);
    }

    function buildDocViewUrl(fileName, page) {
        const name = String(fileName || "").trim();
        if (!name) return "";
        const encodedName = safeEncodePathSegment(name);
        const pn = normalizePageValue(page);
        if (pn != null) return `/document/view/${sessionId}/${encodedName}#page=${pn}`;
        return `/document/view/${sessionId}/${encodedName}`;
    }

    function mapRefs(docs) {
        const arr = Array.isArray(docs) ? docs : [];
        const out = [];
        const seen = new Set();

        for (const raw of arr) {
            if (!raw) continue;

            const r = typeof raw === "string" ? { source: raw } : raw;

            const source =
                String(
                    r.source ||
                    r.title ||
                    r.name ||
                    r.fileName ||
                    r.filename ||
                    r.originalName ||
                    r.displayName ||
                    "문서"
                ).trim() || "문서";

            const page = Number.isFinite(Number(r.page)) ? Number(r.page) : null;

            const extCandidate =
                String(
                    r.ext ||
                    r.extension ||
                    getExt(r.fileName || r.filename || r.name || source)
                ).toLowerCase().trim();

            let url =
                String(
                    r.url ||
                    r.viewUrl ||
                    r.view_url ||
                    r.previewUrl ||
                    r.preview_url ||
                    r.downloadUrl ||
                    r.download_url ||
                    ""
                ).trim();

            const fileNameCandidate = String(r.fileName || r.filename || r.name || "").trim();

            let ext = extCandidate;

            if (!ext) ext = getExt(fileNameCandidate || source);

            if (!url) {
                const nameForUrl = fileNameCandidate || source;
                if (getExt(nameForUrl) === "pdf") {
                    url = buildDocViewUrl(nameForUrl, page);
                    ext = "pdf";
                }
            }

            if (!url) continue;

            const key = `${source}|${url}|${ext}|${page || ""}`;
            if (seen.has(key)) continue;
            seen.add(key);

            out.push({
                source,
                url,
                ext,
                page,
            });
        }

        return out;
    }

    function renderRefs(docs) {
        const list = Array.isArray(docs) ? docs : [];
        if (!list.length) return "";

        const maxPreview = 3;

        const itemHtml = (d) => {
            const isPdf = String(d.ext || "").toLowerCase().trim() === "pdf";
            const disCls = isPdf ? "" : " is-disabled";
            const tip = isPdf ? "미리보기" : "PDF 파일만 미리보기가 제공됩니다.";

            const meta = d.page ? `${d.page} p.` : (d.ext ? d.ext.toUpperCase() : "FILE");

            return `
      <div class="cb-refrow" data-url="${escapeHtml(d.url || "")}" data-ext="${escapeHtml(d.ext || "")}" data-name="${escapeHtml(d.source || "문서")}">
        <button class="cb-refmain" type="button" aria-label="출처">
          <div class="cb-ref__name">${escapeHtml(d.source || "문서")}</div>
          <div class="cb-ref__meta">${escapeHtml(meta)}</div>
        </button>

        <div class="cb-refacts" aria-hidden="false">
          <span class="cb-tipwrap" data-tooltip="${escapeHtml(tip)}">
            <button
              class="cb-refact cb-actbtn cb-refact--preview${disCls}"
              type="button"
              data-action="preview"
              ${isPdf ? "" : 'aria-disabled="true" disabled'}
            >
              <img src="/img/ic-view.svg" alt="미리보기"/>
            </button>
          </span>

          <button
            class="cb-refact cb-actbtn"
            type="button"
            data-action="download"
            data-url="${escapeHtml(d.url || "")}"
            data-filename="${escapeHtml((d.source || "document") + (d.ext ? "." + d.ext : ""))}"
            data-tooltip="다운로드"
          >
            <img src="/img/ic-view-down.svg" alt="다운로드"/>
          </button>
        </div>
      </div>
    `;
        };

        if (list.length <= maxPreview) {
            const items = list.map(itemHtml).join("");
            return `
      <div class="cb-refs__title"><span>출처</span></div>
      <div class="cb-refs__list">${items}</div>
    `;
        }

        const first = list.slice(0, maxPreview);
        const rest = list.slice(maxPreview);
        const items1 = first.map(itemHtml).join("");
        const items2 = rest.map(itemHtml).join("");

        return `
    <div class="cb-refs__title"><span>출처</span></div>
    <div class="cb-refs__list">${items1}</div>
    <div class="cb-refs__more" style="display:none">${items2}</div>
    <button class="cb-refs__toggle" type="button" data-open="false" data-morecount="${rest.length}">+${rest.length}개 더보기</button>
  `;
    }


    function addBotStreamLoadingMessage(enableRefs) {
        endUserCardStack();
        const id = `cbStream_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const refsHtml = enableRefs ? `<div class="cb-refs" aria-label="출처"></div>` : ``;
        const html = `
      <div class="cb-msg cb-msg--bot cb-msg--streaming" data-stream-id="${id}">
        <div class="cb-bubble">
          <div class="cb-bubble__text">
            <div class="cb-clarify" style="display:none">AT-I에게 좀 더 자세한 정보를 제공해 주세요.</div>
            <div class="cb-progress" style="display:flex">
              <span class="cb-progress__text">질문의 의도를 파악하고 있습니다.</span>
            </div>
            <pre style="display:none" data-rawtext=""></pre>
            ${refsHtml}
          </div>
          <div class="cb-meta"></div>
          ${actionsHtml({ copy: true })}
        </div>
      </div>
    `;
        body.insertAdjacentHTML("beforeend", html);
        const msgEl = body.querySelector(`.cb-msg[data-stream-id="${id}"]`);
        const preEl = msgEl ? msgEl.querySelector(".cb-bubble__text pre") : null;
        const metaEl = msgEl ? msgEl.querySelector(".cb-meta") : null;
        const progressEl = msgEl ? msgEl.querySelector(".cb-progress") : null;
        const progressTextEl = progressEl ? progressEl.querySelector(".cb-progress__text") : null;
        const clarifyEl = msgEl ? msgEl.querySelector(".cb-clarify") : null;
        const refsEl = enableRefs && msgEl ? msgEl.querySelector(".cb-refs") : null;

        if (refsEl) {
            refsEl.classList.remove("is-open");
            refsEl.innerHTML = "";
        }
        scrollToBottom();
        return { msgEl, preEl, metaEl, progressEl, progressTextEl, refsEl, clarifyEl, started: false, done: false, pendingRefs: [], hasProgress: false };
    }

    async function forceDownloadFile(url, filename) {
        const u = String(url || "").trim();
        if (!u) return;

        const name = (String(filename || "").trim() || "download").replace(/[\\/:*?"<>|]/g, "_");

        const res = await fetch(withCacheBuster(u), { method: "GET", credentials: "same-origin" });
        if (!res.ok) {
            let t = "";
            try { t = await res.text(); } catch (e) { }
            throw new Error(t || "다운로드에 실패했습니다.");
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = name;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }


    function showClarify(handle) {
        if (!handle || !handle.clarifyEl) return;
        handle.clarifyEl.style.display = "block";
        scrollToBottom();
    }

    function showProgress(handle, stepText) {
        if (!handle) return;
        if (handle.started) return;
        handle.hasProgress = true;
        if (handle.progressEl) handle.progressEl.style.display = "flex";
        if (handle.progressTextEl) handle.progressTextEl.textContent = String(stepText || "");
        if (handle.preEl) handle.preEl.style.display = "none";
        scrollToBottom();
    }

    function startStreaming(handle) {
        if (!handle || handle.started) return;
        handle.started = true;
        if (handle.progressEl) handle.progressEl.style.display = "none";
        if (handle.preEl) handle.preEl.style.display = "block";
        if (handle.preEl && handle.preEl.getAttribute("data-rawtext") == null) handle.preEl.setAttribute("data-rawtext", "");
        scrollToBottom();
    }

    function appendStreamText(handle, chunk) {
        if (!handle || !handle.preEl) return;
        const prev = handle.preEl.getAttribute("data-rawtext") || "";
        const next = prev + String(chunk || "");
        handle.preEl.setAttribute("data-rawtext", next);
        handle.preEl.innerHTML = renderRichText(next);
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
    }

    function applyStreamRefs(handle, docs) {
        if (!handle) return;
        const refs = mapRefs(docs);
        handle.pendingRefs = refs;

        if (!handle.refsEl) return;
        if (!handle.done) {
            handle.refsEl.classList.remove("is-open");
            handle.refsEl.innerHTML = "";
            return;
        }

        if (!refs.length) {
            handle.refsEl.classList.remove("is-open");
            handle.refsEl.innerHTML = "";
            return;
        }

        handle.refsEl.innerHTML = renderRefs(refs);
        handle.refsEl.classList.add("is-open");
        scrollToBottom();
    }

    function finalizeStream(handle) {
        if (!handle || !handle.metaEl) return;
        handle.done = true;

        if (handle.progressEl) handle.progressEl.style.display = "none";
        if (handle.preEl) handle.preEl.style.display = "block";

        if (!handle.metaEl.textContent) handle.metaEl.textContent = formatTime(new Date());
        if (handle && handle.msgEl) handle.msgEl.classList.remove("cb-msg--streaming");

        if (handle.refsEl) {
            const list = Array.isArray(handle.pendingRefs) ? handle.pendingRefs : [];
            if (list.length) {
                handle.refsEl.innerHTML = renderRefs(list);
                handle.refsEl.classList.add("is-open");
            } else {
                handle.refsEl.classList.remove("is-open");
                handle.refsEl.innerHTML = "";
            }
        }
    }

    function parseSseFrame(frame) {
        const lines = String(frame || "").split("\n");
        let eventName = "";
        const dataParts = [];
        for (const line of lines) {
            if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
                dataParts.push(line.slice(5));
            }
        }
        const data = dataParts.join("\n").replace(/^\s*/, "");
        return { eventName, data };
    }

    async function streamEventText(url, options, handlers) {
        const onText = handlers && typeof handlers.onText === "function" ? handlers.onText : null;
        const onFirstToken = handlers && typeof handlers.onFirstToken === "function" ? handlers.onFirstToken : null;
        const onRefs = handlers && typeof handlers.onRefs === "function" ? handlers.onRefs : null;
        const onProgress = handlers && typeof handlers.onProgress === "function" ? handlers.onProgress : null;
        const onClarification = handlers && typeof handlers.onClarification === "function" ? handlers.onClarification : null;
        const onPercent = handlers && typeof handlers.onPercent === "function" ? handlers.onPercent : null;
        const onDone = handlers && typeof handlers.onDone === "function" ? handlers.onDone : null;
        const acceptRefs = !!(handlers && handlers.acceptRefs);

        const res = await fetch(url, options);

        if (!res.ok) {
            let t = "";
            try {
                t = await res.text();
            } catch (e) { }
            const err = new Error(t || "요청 처리 중 오류가 발생했습니다.");
            err.status = res.status;
            throw err;
        }

        if (!res.body) {
            let t = "";
            try {
                t = await res.text();
            } catch (e) { }
            if (t) {
                if (typeof onFirstToken === "function") onFirstToken();
                if (typeof onText === "function") onText(t);
                return;
            }
            throw new Error("응답을 받을 수 없습니다.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buf = "";
        let first = true;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            if (!chunk) continue;

            buf += chunk;
            while (true) {
                const sep = buf.indexOf("\n\n");
                if (sep < 0) break;

                const frame = buf.slice(0, sep);
                buf = buf.slice(sep + 2);

                const { eventName, data } = parseSseFrame(frame);

                if (data === "[DONE]") {
                    if (typeof onDone === "function") onDone("");
                    return;
                }

                if (eventName === "done" && !data) {
                    if (typeof onDone === "function") onDone("");
                    return;
                }

                if (eventName === "start" && !data) {
                    if (typeof onProgress === "function") onProgress("질문의 의도를 파악하고 있습니다.");
                    continue;
                }

                if (!data) continue;

                if (data.startsWith("{") || data.startsWith("[")) {
                    let j = null;
                    try {
                        j = JSON.parse(data);
                    } catch (e) {
                        if (first) {
                            first = false;
                            if (typeof onFirstToken === "function") onFirstToken();
                        }
                        if (typeof onText === "function") onText(data);
                        continue;
                    }

                    const hasPercent = j && typeof j.percent !== "undefined";

                    // stage + percent 형식 (template SSE: {"stage":"extract","percent":5,"message":"..."})
                    if (j && j.stage && hasPercent && !j.type) {
                        if (j.stage === "done") {
                            if (typeof onPercent === "function") onPercent(j.percent, j.message || "완료");
                            if (typeof onDone === "function") onDone(j.data ? JSON.stringify(j.data) : (j.message || ""));
                        } else {
                            if (typeof onPercent === "function") onPercent(j.percent, j.message || "");
                        }
                        continue;
                    }

                    if (j && (j.type === "percent") && hasPercent) {
                        if (typeof onPercent === "function") onPercent(j.percent, j.message || "");
                        continue;
                    }

                    if (j && j.type === "progress") {
                        if (hasPercent && typeof onPercent === "function") {
                            onPercent(j.percent, j.message || j.step || "");
                            continue;
                        }

                        if (typeof onProgress === "function") onProgress(j.step || j.message || "");
                        continue;
                    }

                    if (acceptRefs && j && j.type === "references" && Array.isArray(j.docs)) {
                        if (typeof onRefs === "function") onRefs(j.docs);
                        continue;
                    }

                    if (j && j.type === "done") {
                        const msg = String((j && j.message) || "").trim();
                        if (hasPercent && typeof onPercent === "function") {
                            onPercent(j.percent, msg || "완료");
                        } else if (typeof onProgress === "function" && (msg || msg === "")) {
                            onProgress(msg || "완료");
                        }
                        if (typeof onDone === "function") onDone(msg);
                        continue;
                    }

                    if (j && j.type === "answer_start") {
                        continue;
                    }

                    if (j && j.type === "answer_token") {
                        const content = String(j.content || "");
                        if (content) {
                            if (first) {
                                first = false;
                                if (typeof onFirstToken === "function") onFirstToken();
                            }
                            if (typeof onText === "function") onText(content);
                        } else {
                            if (first) {
                                first = false;
                                if (typeof onFirstToken === "function") onFirstToken();
                            }
                        }
                        continue;
                    }

                    if (j && j.type === "clarification_needed") {
                        if (typeof onClarification === "function") onClarification(j.message || "", j.thread_id || null);
                        if (first) {
                            first = false;
                            if (typeof onFirstToken === "function") onFirstToken();
                        }
                        if (typeof onText === "function") onText(String(j.message || ""));
                        continue;
                    }

                    if (j && j.type === "answer") {
                        const raw = String(j.content || "");
                        const content = first ? raw.trimStart() : raw;
                        if (content) {
                            if (first) {
                                first = false;
                                if (typeof onFirstToken === "function") onFirstToken();
                            }
                            if (typeof onText === "function") onText(content);
                        }
                        continue;
                    }

                    const content = j && j.choices && j.choices[0] && j.choices[0].delta ? j.choices[0].delta.content : null;

                    if (typeof content === "string" && content.length) {
                        if (first) {
                            first = false;
                            if (typeof onFirstToken === "function") onFirstToken();
                        }
                        if (typeof onText === "function") onText(content);
                    }
                } else {
                    if (first) {
                        first = false;
                        if (typeof onFirstToken === "function") onFirstToken();
                    }
                    if (typeof onText === "function") onText(data);
                }
            }
        }

        if (typeof onDone === "function") onDone("");
    }

    function closePop() {
        if (!pop || !plusBtn) return;
        pop.classList.remove("is-open");
        pop.setAttribute("aria-hidden", "true");
        plusBtn.setAttribute("aria-expanded", "false");
    }

    function openPop() {
        if (!pop || !plusBtn) return;
        closeTray();
        closeDocPopup();
        closeGuideModal();
        pop.classList.add("is-open");
        pop.setAttribute("aria-hidden", "false");
        plusBtn.setAttribute("aria-expanded", "true");
    }

    function togglePop() {
        if (!pop) return;
        if (pop.classList.contains("is-open")) closePop();
        else openPop();
    }

    function isTrayOpen() {
        return !!(tray && tray.classList.contains("is-open"));
    }

    function openTray() {
        if (!tray) return;
        closePop();
        closeDocPopup();
        closeGuideModal();
        tray.classList.add("is-open");
        tray.setAttribute("aria-hidden", "false");
        tray.style.setProperty("width", "94%", "important");

        setTimeout(() => {
            if (trayBody) trayBody.scrollTop = 0;
        }, 0);
    }

    function closeTray() {
        if (!tray) return;
        tray.classList.remove("is-open");
        tray.setAttribute("aria-hidden", "true");
    }

    function toggleTray() {
        if (isTrayOpen()) closeTray();
        else openTray();
    }

    function openGuideModal() {
        if (!guideModal) return;
        closePop();
        closeTray();
        closeDocPopup();
        guideModal.classList.add("is-open");
        guideModal.setAttribute("aria-hidden", "false");
    }

    function closeGuideModal() {
        if (!guideModal) return;
        guideModal.classList.remove("is-open");
        guideModal.setAttribute("aria-hidden", "true");
    }

    if (guideBtn && guideModal) {
        guideBtn.addEventListener("click", () => {
            if (guideModal.classList.contains("is-open")) closeGuideModal();
            else openGuideModal();
        });
    }

    if (guideClose) {
        guideClose.addEventListener("click", closeGuideModal);
    }

    function consumeContinueFlag() {
        const isContinue = !!continueNext;
        const threadId = continueThreadId ? String(continueThreadId) : "";
        continueNext = false;
        return { isContinue, threadId };
    }

    function updateChipRow() {
        const hasAny =
            (researchTag && researchTag.style.display !== "none") ||
            (templateTag && templateTag.style.display !== "none") ||
            (templateFileTag && templateFileTag.style.display !== "none") ||
            (documentTag && documentTag.style.display !== "none") ||
            (translateTag && translateTag.style.display !== "none");

        chipRow.classList.toggle("is-open", !!hasAny);
        chipRow.setAttribute("aria-hidden", hasAny ? "false" : "true");
        inputWrap.classList.toggle("has-chips", !!hasAny);
        autoResizeInput();
    }

    function mountChip(el) {
        if (!el) return;
        if (el.parentElement !== chipRow) chipRow.appendChild(el);
        updateChipRow();
    }

    function ensureResearchTag() {
        if (researchTag) return researchTag;
        researchTag = document.createElement("button");
        researchTag.type = "button";
        researchTag.id = "cbResearchTag";
        researchTag.setAttribute("aria-pressed", "false");
        researchTag.innerHTML = `
      <img src="/img/ic-research-mini.png" class="cb-tag__icon" />
      <span class="cb-rch__label">리서치</span>
      <span class="cb-rch__x" aria-hidden="true">×</span>
    `;
        researchTag.addEventListener("click", (e) => {
            e.preventDefault();
            setResearchMode(false);
            input.focus();
        });
        mountChip(researchTag);
        researchTag.style.display = "none";
        updateChipRow();
        return researchTag;
    }

    function ensureTemplateTag() {
        if (templateTag) return templateTag;
        templateTag = document.createElement("button");
        templateTag.type = "button";
        templateTag.id = "cbTemplateTag";
        templateTag.setAttribute("aria-pressed", "false");
        templateTag.innerHTML = `
      <img src="/img/ic-select.png" class="cb-tag__icon" />
      <span class="cb-tpltag__label"></span>
      <span class="cb-tpltag__x" aria-hidden="true">×</span>
    `;
        templateTag.addEventListener("click", (e) => {
            e.preventDefault();
            setTemplate(null);
            input.focus();
        });
        ensureResearchTag();
        mountChip(templateTag);
        templateTag.style.display = "none";
        updateChipRow();
        return templateTag;
    }

    function ensureDocTag() {
        if (documentTag) return documentTag;
        documentTag = document.createElement("button");
        documentTag.type = "button";
        documentTag.id = "cbDocumentTag";
        documentTag.setAttribute("aria-pressed", "false");
        documentTag.innerHTML = `
      <span class="cb-taghash" aria-hidden="true">#</span>
      <span class="cb-doctag__label"></span>
      <span class="cb-doctag__x" aria-hidden="true">×</span>
    `;
        documentTag.addEventListener("click", (e) => {
            e.preventDefault();
            setSelectedDocument(null);
            input.focus();
        });
        ensureTemplateTag();
        mountChip(documentTag);
        documentTag.style.display = "none";
        updateChipRow();
        return documentTag;
    }

    function setSelectedDocument(doc) {
        selectedDocument = doc ? { ...doc } : null;

        const tag = ensureDocTag();
        if (!tag) return;
        if (!selectedDocument) {
            tag.style.display = "none";
            tag.setAttribute("aria-pressed", "false");
            const labelEl = tag.querySelector(".cb-doctag__label");
            if (labelEl) labelEl.textContent = "";
            updateChipRow();
            return;
        }

        tag.style.display = "";
        tag.setAttribute("aria-pressed", "true");
        const labelEl = tag.querySelector(".cb-doctag__label");
        if (labelEl) labelEl.textContent = selectedDocument.name || "문서";
        updateChipRow();
    }

    function ensureTemplateFileTag() {
        if (templateFileTag) return templateFileTag;
        templateFileTag = document.createElement("span");
        templateFileTag.id = "cbTemplateFileTag";
        templateFileTag.innerHTML = `<svg class="cb-tplfile__icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg><span class="cb-tplfile__name"></span><button type="button" class="cb-tplfile__x" aria-label="첨부파일 제거">×</button>`;
        templateFileTag.querySelector(".cb-tplfile__x").addEventListener("click", (e) => {
            e.stopPropagation();
            setTemplateFile(null);
        });
        mountChip(templateFileTag);
        templateFileTag.style.display = "none";
        return templateFileTag;
    }

    function setTemplateFile(file) {
        selectedTemplateFile = file || null;
        const tag = ensureTemplateFileTag();
        const attachBtn = ensureTemplateAttachBtn();
        if (!selectedTemplateFile) {
            tag.style.display = "none";
            // 회의록 템플릿이 아직 선택된 상태면 버튼 다시 보여줌
            if (attachBtn) attachBtn.style.display = (selectedTemplate && selectedTemplate.key === "A003") ? "" : "none";
            updateChipRow();
            return;
        }
        const nameEl = tag.querySelector(".cb-tplfile__name");
        if (nameEl) nameEl.textContent = selectedTemplateFile.name;
        tag.style.display = "";
        // 파일이 있으면 버튼 숨김
        if (attachBtn) attachBtn.style.display = "none";
        updateChipRow();
    }

    function ensureTemplateAttachBtn() {
        if (templateAttachBtn) return templateAttachBtn;
        templateAttachBtn = document.createElement("button");
        templateAttachBtn.type = "button";
        templateAttachBtn.id = "cbTemplateAttachBtn";
        templateAttachBtn.setAttribute("aria-label", "첨부파일 추가");
        templateAttachBtn.setAttribute("data-tooltip", "첨부파일 추가");
        templateAttachBtn.innerHTML = `<svg class="cb-tplattach__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg><span class="cb-tplattach__label">첨부파일 추가</span>`;
        templateAttachBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tmpInput = document.createElement("input");
            tmpInput.type = "file";
            tmpInput.style.display = "none";
            document.body.appendChild(tmpInput);
            tmpInput.addEventListener("change", () => {
                const file = tmpInput.files && tmpInput.files[0] ? tmpInput.files[0] : null;
                document.body.removeChild(tmpInput);
                if (file) setTemplateFile(file);
            });
            tmpInput.click();
        });
        mountChip(templateAttachBtn);
        templateAttachBtn.style.display = "none";
        return templateAttachBtn;
    }

    function setTemplate(tpl) {
        if (tpl && isResearchMode) setResearchMode(false);
        selectedTemplate = tpl ? { ...tpl } : null;

        const tag = ensureTemplateTag();
        if (!tag) return;
        if (!selectedTemplate) {
            tag.style.display = "none";
            tag.setAttribute("aria-pressed", "false");
            const labelEl = tag.querySelector(".cb-tpltag__label");
            if (labelEl) labelEl.textContent = "";
            const attachBtn = ensureTemplateAttachBtn();
            if (attachBtn) attachBtn.style.display = "none";
            setTemplateFile(null);
            updateChipRow();
            return;
        }

        tag.style.display = "";
        tag.setAttribute("aria-pressed", "true");
        const labelEl = tag.querySelector(".cb-tpltag__label");
        if (labelEl) labelEl.textContent = selectedTemplate.name || "양식";
        const attachBtn = ensureTemplateAttachBtn();
        if (attachBtn) attachBtn.style.display = selectedTemplate.key === "A003" ? "" : "none";
        updateChipRow();
    }

    function setResearchMode(on) {
        const next = !!on;
        isResearchMode = next;

        const tag = ensureResearchTag();
        if (tag) {
            tag.style.display = isResearchMode ? "" : "none";
            tag.setAttribute("aria-pressed", isResearchMode ? "true" : "false");
        }

        if (input) {
            input.placeholder = isResearchMode ? "디테일한 보고서를 작성해 주세요." : defaultPlaceholder;
        }

        updateChipRow();
        autoResizeInput();
    }

    async function fetchUploadedFiles(force) {
        const f = !!force;
        if (f) {
            uploadedFilesCache = null;
            uploadedFilesPromise = null;
        }

        if (uploadedFilesCache) return uploadedFilesCache;
        if (uploadedFilesPromise) return uploadedFilesPromise;

        uploadedFilesPromise = fetch("/api/chat/files", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: new URLSearchParams({ sessionId: String(sessionId || "") }).toString(),
            credentials: "same-origin",
        })
            .then(async (res) => {
                if (!res.ok) {
                    let t = "";
                    try {
                        t = await res.text();
                    } catch (e) { }
                    throw new Error(t || "파일 목록을 불러오지 못했습니다.");
                }
                return res.json();
            })
            .then((list) => {
                const arr = Array.isArray(list) ? list.map((x) => String(x || "").trim()).filter(Boolean) : [];
                uploadedFilesCache = arr;
                return arr;
            })
            .finally(() => {
                uploadedFilesPromise = null;
            });

        return uploadedFilesPromise;
    }

    function getHashQuery(value) {
        const v = String(value || "");
        const m = v.match(/#([^\s#]*)$/);
        if (!m) return null;
        return m[1] || "";
    }

    function removeHashToken(value) {
        return String(value || "").replace(/#[^\s#]*$/, "").replace(/[ \t]+$/, "");
    }

    function isDocPopOpen() {
        return documentListPopup && documentListPopup.classList.contains("is-open");
    }

    function openDocPopup() {
        if (!documentListPopup) return;
        documentListPopup.style.display = "flex";
        documentListPopup.setAttribute("aria-hidden", "false");
        documentListPopup.classList.add("is-open");
    }

    function closeDocPopup() {
        if (!documentListPopup) return;
        documentListPopup.style.display = "none";
        documentListPopup.setAttribute("aria-hidden", "true");
        documentListPopup.classList.remove("is-open");
        documentListPopup.innerHTML = "";
    }

    function populateDocumentList(popup, list, keyword, loading, errorText) {
        const k = String(keyword || "").trim();
        const head = `
                        <div class="cb-tray__head">
                            <div class="cb-tray__titlewrap">
                            <div class="cb-tray__title">업로드 파일 선택</div>
                            <div class="cb-tray__subnote">※업로드된 파일은 7일간 보관되며,<br/>보관 기간 만료 시 시스템에 의해 자동 삭제됩니다.</div>
                            </div>
                            <button type="button" class="cb-tray__close" data-action="close" aria-label="닫기">×</button>
                        </div>
                    `;
        if (errorText) {
            popup.innerHTML = `${head}<div class="cb-tray__body"><div class="cb-tpl" style="cursor:default"><div class="cb-tpl__name">${escapeHtml(errorText)}</div></div></div>`;
            return;
        }

        if (loading) {
            popup.innerHTML = `${head}<div class="cb-tray__body"><div class="cb-tpl" style="cursor:default"><div class="cb-tpl__name">불러오는 중...</div></div></div>`;
            return;
        }

        const arr = Array.isArray(list) ? list : [];
        let filtered = arr;

        if (k) {
            const lower = k.toLowerCase();
            filtered = arr.filter((name) => String(name || "").toLowerCase().includes(lower));
        }

        const shown = filtered;
        if (!shown.length) {
            popup.innerHTML = `${head}<div class="cb-tray__body"><div class="cb-tpl" style="cursor:default"><div class="cb-tpl__name">검색 결과가 없습니다.</div></div></div>`;
            return;
        }

        const items = shown
            .map((name) => {
                const safe = escapeHtml(name);
                return `
          <div class="cb-tpl" role="option" data-doc-name="${safe}" aria-selected="false">
            <div class="cb-tpl__top">
              <div class="cb-tpl__name">${safe}</div>
              <div class="cb-tpl__actions">
                <button type="button" class="cb-tpl__btn" data-action="summary">요약</button>
                <button type="button" class="cb-tpl__btn" data-action="question">질문</button>
              </div>
            </div>
          </div>
        `;
            })
            .join("");
        popup.innerHTML = `${head}<div class="cb-tray__body">${items}</div>`;
    }

    async function openDocsPopupFromButton() {
        closePop();
        closeTray();
        closeGuideModal();
        openDocPopup();
        populateDocumentList(documentListPopup, [], "", true, "");

        try {
            const files = await fetchUploadedFiles(true);
            populateDocumentList(documentListPopup, files, "", false, "");
        } catch (err) {
            populateDocumentList(
                documentListPopup,
                [],
                "",
                false,
                err && err.message ? String(err.message) : "파일 목록을 불러오지 못했습니다."
            );
        }
    }

    input.addEventListener("input", async (e) => {
        const value = e && e.target ? String(e.target.value || "") : "";
        const q = getHashQuery(value);

        if (q == null) {
            if (isDocPopOpen()) closeDocPopup();
            return;
        }

        openDocPopup();
        populateDocumentList(documentListPopup, [], q, true, "");

        try {
            const files = await fetchUploadedFiles(false);
            populateDocumentList(documentListPopup, files, q, false, "");
        } catch (err) {
            populateDocumentList(
                documentListPopup,
                [],
                q,
                false,
                err && err.message ? String(err.message) : "파일 목록을 불러오지 못했습니다."
            );
        }
    });

    function startSummaryToChat(docName) {
        const name = String(docName || "").trim();
        if (!name) return;
        if (summaryBusy) return;

        summaryBusy = true;

        const handle = addBotStreamLoadingMessage(true);

        const prefix = `**요약**\n\n`;
        let prefixInjected = false;

        const payload = {
            sessionId,
            message: "summarize",
            deepResearch: false,
            templateKey: null,
            isContinue: false,
            targetFileName: name,
        };

        streamEventText(
            "/api/chat/stream",
            {
                method: "POST",
                headers: { "Content-Type": "application/json; charset=UTF-8", Accept: "text/event-stream" },
                body: JSON.stringify(payload),
                credentials: "same-origin",
            },
            {
                acceptRefs: true,
                onProgress: (step) => {
                    const s = String(step || "").trim();
                    if (!s) return;
                    showProgress(handle, s);
                },
                onFirstToken: () => {
                    startStreaming(handle);
                    if (!prefixInjected) {
                        appendStreamText(handle, prefix);
                        prefixInjected = true;
                    }
                },
                onText: (t) => {
                    startStreaming(handle);
                    if (!prefixInjected) {
                        appendStreamText(handle, prefix);
                        prefixInjected = true;
                    }
                    appendStreamText(handle, t);
                },
                onRefs: (docs) => applyStreamRefs(handle, docs),
                onClarification: () => { },
            }
        )
            .then(() => {
                startStreaming(handle);
                if (!prefixInjected) {
                    appendStreamText(handle, prefix);
                    prefixInjected = true;
                }
                finalizeStream(handle);
                const raw = handle.preEl ? handle.preEl.getAttribute("data-rawtext") || "" : "";
                if (!raw.trim()) appendStreamText(handle, "요약 결과가 없습니다.");
            })
            .catch((err) => {
                if (handle && handle.msgEl) handle.msgEl.remove();
                addBotMessage(err && err.message ? String(err.message) : "요약 처리 중 오류가 발생했습니다.");
            })
            .finally(() => {
                summaryBusy = false;
                input.focus();
                autoResizeInput();
            });
    }

    documentListPopup.addEventListener("click", (e) => {
        const closeBtn = e.target && e.target.closest ? e.target.closest('[data-action="close"]') : null;
        if (closeBtn) {
            e.preventDefault();
            closeDocPopup();
            input.focus();
            return;
        }

        const btn = e.target && e.target.closest ? e.target.closest(".cb-tpl__btn") : null;
        const item = e.target && e.target.closest ? e.target.closest(".cb-tpl[data-doc-name]") : null;
        if (!item) return;

        const name = item.getAttribute("data-doc-name") || "";
        if (!name) return;

        if (btn) {
            const action = btn.getAttribute("data-action") || "";
            if (action === "summary") {
                input.value = removeHashToken(input.value);
                autoResizeInput();
                closeDocPopup();

                setSelectedDocument(null);

                addUserDocMessageByName(name);
                startSummaryToChat(name);
                return;
            }
            if (action === "question") {
                setSelectedDocument({ name });
                input.value = removeHashToken(input.value);
                autoResizeInput();
                closeDocPopup();
                input.focus();
                return;
            }
        }

        setSelectedDocument({ name });
        input.value = removeHashToken(input.value);
        autoResizeInput();
        input.focus();
        closeDocPopup();
    });

    function sendTextMessage(msg, targetNameOverride, translateTo) {
        closeTray();
        closeGuideModal();
        const m = String(msg || "").trim();
        if (m) addUserMessage(m, translateTo);

        input.value = "";
        autoResizeInput();

        setSending(true);

        const handle = addBotStreamLoadingMessage(true);
        const cont = consumeContinueFlag();

        const targetName = String(targetNameOverride || "").trim();
        const payload = {
            sessionId,
            message: m,
            deepResearch: false,
            templateKey: null,
            isContinue: cont.isContinue,
            targetFileName: targetName,
        };
        if (translateTo) payload.translate_to = translateTo;
        if (cont.threadId) payload.threadId = cont.threadId;

        streamEventText(
            "/api/chat/stream",
            {
                method: "POST",
                headers: { "Content-Type": "application/json; charset=UTF-8", Accept: "text/event-stream" },
                body: JSON.stringify(payload),
                credentials: "same-origin",
            },
            {
                acceptRefs: true,
                onProgress: (step) => showProgress(handle, step),
                onText: (t) => {
                    startStreaming(handle);
                    appendStreamText(handle, t);
                },
                onFirstToken: () => startStreaming(handle),
                onRefs: (docs) => applyStreamRefs(handle, docs),
                onClarification: (message, threadId) => {
                    showClarify(handle);
                    continueNext = true;
                    if (threadId) continueThreadId = threadId;
                },
            }
        )
            .then(() => {
                startStreaming(handle);
                finalizeStream(handle);
                const raw = handle.preEl ? handle.preEl.getAttribute("data-rawtext") || "" : "";
                if (!raw.trim()) appendStreamText(handle, "응답을 받았지만 표시할 내용이 없습니다.");
            })
            .catch((err) => {
                if (handle && handle.msgEl) handle.msgEl.remove();
                addBotMessage(err && err.message ? String(err.message) : "요청 처리 중 오류가 발생했습니다.");
            })
            .finally(() => {
                setSending(false);
                input.focus();
                autoResizeInput();
            });
    }

    function uploadFile(file, messageText, templateKey, onDone, existingHandle) {
        if (!file) {
            if (typeof onDone === "function") onDone();
            return;
        }

        closeTray();
        closeGuideModal();

        const msg = String(messageText || "").trim();

        const uploadHandle = existingHandle || addUserFileMessageWithProgress(file);
        if (!existingHandle && msg) addUserMessage(msg);

        const cont = consumeContinueFlag();

        const formData = new FormData();
        formData.append("file", file);
        formData.append("sessionId", sessionId);
        formData.append("deepResearch", "false");
        formData.append("templateKey", templateKey || "");
        formData.append("message", msg);
        formData.append("isContinue", cont.isContinue ? "true" : "false");
        if (cont.threadId) formData.append("threadId", cont.threadId);

        setSending(true);
        let botHandle = null;
        let pendingRefs = [];
        let doneMessage = "";

        const ensureBotHandle = () => {
            if (botHandle) return botHandle;
            botHandle = addBotStreamLoadingMessage(true);
            if (pendingRefs.length) applyStreamRefs(botHandle, pendingRefs);
            return botHandle;
        };

        streamEventText(
            "/api/chat/upload/stream",
            { method: "POST", headers: { Accept: "text/event-stream" }, body: formData, credentials: "same-origin" },
            {
                acceptRefs: true,
                onPercent: (percent, message) => {
                    updateUploadProgress(uploadHandle, percent, message);
                },
                onProgress: (step) => {
                    const s = String(step || "").trim();
                    if (!s) return;
                    updateUploadProgress(uploadHandle, uploadHandle._lastPercent || 0, s);
                },
                onText: (t) => {
                    ensureBotHandle();
                    startStreaming(botHandle);
                    appendStreamText(botHandle, t);
                },
                onFirstToken: () => {
                    finalizeUploadProgress(uploadHandle);
                    ensureBotHandle();
                    startStreaming(botHandle);
                },
                onRefs: (docs) => {
                    pendingRefs = mapRefs(docs);
                    if (botHandle) applyStreamRefs(botHandle, pendingRefs);
                },
                onClarification: (message, threadId) => {
                    ensureBotHandle();
                    showClarify(botHandle);
                    continueNext = true;
                    if (threadId) continueThreadId = threadId;
                },
                onDone: (message) => {
                    doneMessage = String(message || "").trim();
                    updateUploadProgress(uploadHandle, 100, doneMessage || "완료");
                    finalizeUploadProgress(uploadHandle);
                },
            }
        )
            .then(() => {
                updateUploadProgress(uploadHandle, 100, doneMessage || uploadHandle._lastDoneMessage || "완료");
                finalizeUploadProgress(uploadHandle);

                if (!botHandle) {
                    if (msg) addBotMessage("파일이 정상적으로 업로드 되었습니다.");
                    return;
                }

                const h = botHandle;
                startStreaming(h);
                finalizeStream(h);

                const raw = h.preEl ? (h.preEl.getAttribute("data-rawtext") || "") : "";
                const hasRaw = !!raw.trim();

                if (!hasRaw) {
                    if (msg) {
                        appendStreamText(h, "파일이 정상적으로 업로드 되었습니다.");
                    } else {
                        if (h.msgEl) h.msgEl.remove();
                    }
                }
            })
            .catch((err) => {
                updateUploadProgress(uploadHandle, uploadHandle._lastPercent || 0, "업로드 중 오류가 발생했습니다.");
                finalizeUploadProgress(uploadHandle);

                if (botHandle && botHandle.msgEl) botHandle.msgEl.remove();
                addBotMessage(err && err.message ? String(err.message) : "업로드 중 오류가 발생했습니다.");
            })
            .finally(() => {
                setSending(false);
                if (typeof onDone === "function") onDone();
                input.focus();
                autoResizeInput();
            });
    }

    async function requestTemplateDownload(messageText, templateKey, attachedFile, uploadHandle) {
        const msg = String(messageText || "").trim();
        setSending(true);

        const cont = consumeContinueFlag();

        const fd = new FormData();
        fd.append("sessionId", sessionId);
        fd.append("message", msg);
        fd.append("deepResearch", "false");
        fd.append("templateKey", String(templateKey || ""));
        if (attachedFile) fd.append("file", attachedFile, attachedFile.name);

        let botHandle = null;

        try {
            await streamEventText(
                "/api/chat/template",
                { method: "POST", headers: { Accept: "text/event-stream" }, body: fd, credentials: "same-origin" },
                {
                    acceptRefs: true,
                    onPercent: (percent, message) => {
                        if (uploadHandle) updateUploadProgress(uploadHandle, percent, message);
                    },
                    onProgress: (step) => {
                        const s = String(step || "").trim();
                        if (s && uploadHandle) updateUploadProgress(uploadHandle, uploadHandle._lastPercent || 0, s);
                    },
                    onText: (t) => {
                        if (!botHandle) botHandle = addBotStreamLoadingMessage(true);
                        startStreaming(botHandle);
                        appendStreamText(botHandle, t);
                    },
                    onFirstToken: () => {
                        if (uploadHandle) finalizeUploadProgress(uploadHandle);
                        if (!botHandle) botHandle = addBotStreamLoadingMessage(true);
                        startStreaming(botHandle);
                    },
                    onRefs: (docs) => {
                        if (!botHandle) botHandle = addBotStreamLoadingMessage(true);
                        applyStreamRefs(botHandle, docs);
                    },
                    onDone: (doneMsg) => {
                        if (uploadHandle) finalizeUploadProgress(uploadHandle);
                        if (botHandle) endStreaming(botHandle);
                        if (doneMsg) {
                            try {
                                const d = JSON.parse(doneMsg);
                                if (d && d.success && d.download_url) {
                                    if (botHandle && botHandle.msgEl) botHandle.msgEl.remove();
                                    addBotAttachmentMessage({ filename: d.filename || "generated_template", download_url: d.download_url }, { allowView: true });
                                }
                            } catch (e) { /* not JSON, ignore */ }
                        }
                    },
                }
            );
        } catch (err) {
            if (uploadHandle) finalizeUploadProgress(uploadHandle);
            if (botHandle && botHandle.msgEl) botHandle.msgEl.remove();
            addBotMessage(err && err.message ? String(err.message) : "요청 처리 중 오류가 발생했습니다.");
        } finally {
            setSending(false);
            input.focus();
            autoResizeInput();
        }
    }

    function addBotAttachmentMessage(fileInfo, opts) {
        endUserCardStack();
        const now = formatTime(new Date());
        const filename = fileInfo && fileInfo.filename ? String(fileInfo.filename) : "파일";
        const downloadUrl = fileInfo && fileInfo.download_url ? String(fileInfo.download_url) : "";
        const ext = getExt(filename);
        const badge = ext ? ext.toUpperCase() : "FILE";

        const allowView = !!(opts && opts.allowView);
        const page = Number.isFinite(Number(fileInfo && fileInfo.page)) ? Number(fileInfo.page) : null;
        const viewUrl = (allowView && ext === "pdf") ? buildDocViewUrl(filename, page) : "";

        const html = `
      <div class="cb-msg cb-msg--bot cb-msg--card" data-copytext="${escapeHtml(filename)}">
        <div class="cb-bubble cb-bubble--card">
          <div class="cb-bubble__text">
            <div class="cb-filecard--new" role="group" aria-label="첨부파일">
              <img src="/img/ic-file.png" class="cb-filecard__icon" alt="" />
              <div class="cb-filecard__meta">
                <div class="cb-filecard__name">${escapeHtml(filename)}</div>
                <div class="cb-filecard__badge">${escapeHtml(badge)}</div>
              </div>
            </div>
          </div>
          <div class="cb-meta">${now}</div>
          ${actionsHtml({ copy: false, downloadUrl, view: allowView, viewUrl, viewExt: ext, viewName: filename })}
        </div>
      </div>
    `;
        body.insertAdjacentHTML("beforeend", html);
        scrollToBottom();
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
    }

    function setSending(isSending) {
        sendBtn.disabled = isSending;
        input.disabled = isSending;
        if (widget) widget.classList.toggle("is-sending", isSending);
    }

    function startImmediateUpload(file) {
        const tplKey = selectedTemplate ? selectedTemplate.key || "" : "";
        if (selectedTemplate) {
            addUserTemplateMessage(selectedTemplate);
            setTemplate(null);
        }
        uploadFile(file, "", tplKey, () => {
            input.focus();
            autoResizeInput();
        });
    }

    function sendMessage() {
        const msg = String(input.value || "").trim();
        const tpl = selectedTemplate ? { ...selectedTemplate } : null;
        const tplKey = tpl ? tpl.key || "" : "";
        const attachedFile = selectedTemplateFile || null;
        const docName = selectedDocument && selectedDocument.name ? String(selectedDocument.name) : "";
        const translateTo = selectedTranslate || "";

        if (!msg && !tplKey) return;

        if (tpl) {
            setTemplate(null);
        }

        if (translateTo) {
            setTranslate(null);
        }

        input.value = "";
        autoResizeInput();

        if (tplKey) {
            const uploadHandle = addUserTemplateWithFileMessage(tpl, attachedFile);
            if (msg) addUserMessage(msg, translateTo);
            requestTemplateDownload(msg, tplKey, attachedFile, uploadHandle);
            return;
        }

        if (docName) {
            addUserDocMessageByName(docName);
            setSelectedDocument(null);
            sendTextMessage(msg, docName, translateTo);
            return;
        }

        sendTextMessage(msg, "", translateTo);
    }

    sendBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeDocPopup();
        sendMessage();
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            closeDocPopup();
            sendMessage();
        }
        if (e.key === "Escape") {
            closeDocPopup();
        }
    });

    input.addEventListener("input", () => {
        autoResizeInput();
    });

    if (fileInput) {
        fileInput.removeAttribute("accept");
    }

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            const files = fileInput.files ? Array.from(fileInput.files) : [];
            fileInput.value = "";
            if (!files.length) return;

            const first = files.find(isAllowedFile);
            if (!first) return;

            closePop();
            closeTray();
            closeDocPopup();
            closeGuideModal();
            startImmediateUpload(first);
        });
    }

    if (tplFileInput) {
        tplFileInput.addEventListener("change", () => {
            const files = tplFileInput.files ? Array.from(tplFileInput.files) : [];
            tplFileInput.value = "";
            if (!files.length) return;
            const first = files[0];
            if (!first) return;
            setTemplateFile(first);
        });
    }

    function setDragOver(on) {
        if (!widget) return;
        widget.classList.toggle("is-dragover", !!on);
    }

    function pickDroppedFile(dt) {
        if (!dt) return null;
        const files = dt.files ? Array.from(dt.files) : [];
        if (!files.length) return null;
        return files.find(isAllowedFile) || null;
    }

    if (widget) {
        let dragDepth = 0;
        widget.addEventListener("dragenter", (e) => {
            e.preventDefault();
            dragDepth += 1;
            setDragOver(true);
        });
        widget.addEventListener("dragover", (e) => {
            e.preventDefault();
            setDragOver(true);
        });
        widget.addEventListener("dragleave", (e) => {
            e.preventDefault();
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) setDragOver(false);
        });
        widget.addEventListener("drop", (e) => {
            e.preventDefault();
            dragDepth = 0;
            setDragOver(false);

            const f = pickDroppedFile(e.dataTransfer);
            if (!f) return;

            closePop();
            closeTray();
            closeDocPopup();
            closeGuideModal();
            startImmediateUpload(f);
        });
    }

    if (plusBtn && pop) {
        plusBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeDocPopup();
            togglePop();
        });

        document.addEventListener("click", (e) => {
            if (pop.classList.contains("is-open")) {
                const inside = pop.contains(e.target) || plusBtn.contains(e.target);
                if (!inside) closePop();
            }

            if (isTrayOpen()) {
                const insideTray = tray.contains(e.target) || inputWrap.contains(e.target);
                if (!insideTray) closeTray();
            }

            if (isDocPopOpen()) {
                const insideDoc = documentListPopup.contains(e.target) || inputWrap.contains(e.target);
                if (!insideDoc) closeDocPopup();
            }

            if (guideModal && guideModal.classList.contains("is-open")) {
                const insideGuide = guideModal.contains(e.target) || guideBtn.contains(e.target);
                if (!insideGuide) closeGuideModal();
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closePop();
                closeTray();
                closeViewer();
                closeDocPopup();
                closeGuideModal();
            }
        });
    } else {
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeTray();
                closeViewer();
                closeDocPopup();
                closeGuideModal();
            }
        });
    }

    if (docsBtn) {
        docsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeDocPopup();
            openDocsPopupFromButton();
        });
    }

    if (actionUpload && fileInput) {
        actionUpload.addEventListener("click", () => {
            closePop();
            closeTray();
            closeDocPopup();
            closeGuideModal();
            fileInput.click();
        });
    }

    if (actionSelect) {
        actionSelect.addEventListener("click", () => {
            closePop();
            closeDocPopup();
            closeGuideModal();
            toggleTray();
            if (!isTrayOpen()) input.focus();
        });
    }

    if (actionUpResearch) {
        actionUpResearch.addEventListener("click", (e) => {
            e.preventDefault();
            closePop();
            closeTray();
            closeDocPopup();
            closeGuideModal();
            setResearchMode(!isResearchMode);
            input.focus();
        });
    }

    if (trayClose) {
        trayClose.addEventListener("click", () => {
            closeTray();
            input.focus();
        });
    }

    if (trayBody) {
        const list = Array.isArray(window.templateList) ? window.templateList : [];

        if (list.length === 0) {
            trayBody.innerHTML = `<div class="cb-tpl" style="cursor:default"><div class="cb-tpl__name">템플릿이 없습니다.</div></div>`;
        } else {
            trayBody.innerHTML = list
                .map((t) => {
                    const key = escapeHtml(t.key);
                    const name = escapeHtml(t.name);
                    const fileName = escapeHtml(t.fileName);

                    return `
            <button class="cb-tpl" type="button" data-template="${key}" data-template-name="${name}" data-template-file="${fileName}">
              <div class="cb-tpl__top">
                <span style="display:none;">${key}</span>
                <div class="cb-tpl__name">${name}</div>
              </div>
              <div class="cb-tpl__desc">${fileName}</div>
            </button>
          `;
                })
                .join("");
        }

        trayBody.addEventListener("click", (e) => {
            const btn = e.target && e.target.closest ? e.target.closest(".cb-tpl") : null;
            if (!btn) return;

            const key = btn.getAttribute("data-template") || "";
            const name = (btn.getAttribute("data-template-name") || "").trim() || "양식";
            setTemplate({ key, name });

            closeTray();
            input.focus();
        });
    }

    if (actionPrint) {
        actionPrint.addEventListener("click", () => {
            closePop();
            closeTray();
            closeDocPopup();
            closeGuideModal();
            const chatHtml = body.innerHTML;
            const w = window.open("", "_blank", "width=900,height=700");
            if (!w) return;

            w.document.open();
            w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Chat Print</title>
          <style>
            body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; background:#fff; color:#111; }
            pre { margin:0; white-space:pre-wrap; word-break:break-word; }
            .wrap{ max-width: 820px; margin: 0 auto; }
            .cb-divider{ text-align:center; margin: 12px 0; color:#666; font-size:12px; }
            .cb-msg{ display:flex; gap:10px; margin:10px 0; align-items:flex-start; }
            .cb-msg--user{ justify-content:flex-end; }
            .cb-avatar{ width:34px; height:34px; display:grid; place-items:center; border:1px solid #ddd; border-radius:12px; }
            .cb-bubble{ max-width:74%; border:1px solid #ddd; border-radius:16px; padding:10px 12px; background:#f3f4f6; }
            .cb-msg--user .cb-bubble{ background:#2f3a4f; color:#fff; border-color:#2f3a4f; }
            .cb-bubble__text{ font-size:13px; line-height:1.45; }
            .cb-meta{ margin-top:6px; font-size:11px; opacity:.7; }
            .cb-actionsbar{ display:none !important; }
            .cb-fileqbar{ display:none !important; }
            .cb-cardstack{ display:none !important; }
            .cb-msg--upload-progress{ display:none !important; }
          </style>
        </head>
        <body>
          <div class="wrap">${chatHtml}</div>
          <script>window.onload=()=>{window.focus();window.print();};<\/script>
        </body>
        </html>
      `);
            w.document.close();
        });
    }

    const searchBtn = document.getElementById("cbSearchBtn");
    const searchBar = document.getElementById("cbSearchBar");
    const searchInput = document.getElementById("cbSearchInput");
    const searchMeta = document.getElementById("cbSearchMeta");
    const searchPrev = document.getElementById("cbSearchPrev");
    const searchNext = document.getElementById("cbSearchNext");
    const searchClose = document.getElementById("cbSearchClose");

    let searchHits = [];
    let searchIndex = -1;

    function isSearchOpen() {
        return !!(searchBar && searchBar.classList.contains("is-open"));
    }

    function escapeRegExp(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function setSearchUI(open) {
        if (!searchBtn || !searchBar) return;
        searchBar.classList.toggle("is-open", open);
        searchBar.setAttribute("aria-hidden", open ? "false" : "true");
        searchBtn.setAttribute("aria-expanded", open ? "true" : "false");
        if (open && searchInput) searchInput.focus();
    }

    function highlightHtmlKeepTags(html, re) {
        const parts = String(html || "").split(/(<[^>]+>)/g);
        return parts
            .map((p) => {
                if (!p) return "";
                if (p.startsWith("<") && p.endsWith(">")) return p;
                return p.replace(re, (m) => `<mark class="cb-mark">${m}</mark>`);
            })
            .join("");
    }

    function clearHighlights() {
        body.querySelectorAll(".cb-hit").forEach((el) => el.classList.remove("cb-hit"));
        const pres = Array.from(body.querySelectorAll(".cb-bubble__text pre"));
        for (const pre of pres) {
            const raw = pre.getAttribute("data-rawtext");
            if (raw == null) continue;

            const msg = pre.closest(".cb-msg");
            const isBot = !!(msg && msg.classList.contains("cb-msg--bot"));

            pre.innerHTML = isBot ? renderRichText(raw) : escapeHtml(raw);
        }
    }

    function rebuildHighlights(keyword) {
        clearHighlights();
        searchHits = [];
        searchIndex = -1;

        const k = (keyword || "").trim();
        if (!k) {
            if (searchMeta) searchMeta.textContent = "0 / 0";
            return;
        }

        const safe = escapeRegExp(k);
        const re = new RegExp(safe, "gi");

        const pres = Array.from(body.querySelectorAll(".cb-bubble__text pre"));

        for (const pre of pres) {
            const raw = pre.getAttribute("data-rawtext");
            if (raw == null) continue;

            const msg = pre.closest(".cb-msg");
            const isBot = !!(msg && msg.classList.contains("cb-msg--bot"));

            const plain = String(raw || "");
            re.lastIndex = 0;
            if (!re.test(plain)) continue;

            const base = isBot ? renderRichText(plain) : escapeHtml(plain);
            re.lastIndex = 0;
            pre.innerHTML = highlightHtmlKeepTags(base, re);

            if (msg) searchHits.push(msg);
        }

        if (searchHits.length === 0) {
            if (searchMeta) searchMeta.textContent = "0 / 0";
            return;
        }

        searchIndex = 0;
        focusHit(0);
    }

    function focusHit(idx) {
        if (!searchHits.length || idx < 0 || idx >= searchHits.length) return;
        body.querySelectorAll(".cb-hit").forEach((el) => el.classList.remove("cb-hit"));

        const target = searchHits[idx];
        target.classList.add("cb-hit");

        const bodyRect = body.getBoundingClientRect();
        const msgRect = target.getBoundingClientRect();
        const delta = msgRect.top - bodyRect.top;

        body.scrollTo({ top: Math.max(0, body.scrollTop + delta - 40), behavior: "smooth" });
        if (searchMeta) searchMeta.textContent = `${idx + 1} / ${searchHits.length}`;
    }

    function moveHit(dir) {
        if (!searchHits.length) return;
        searchIndex = (searchIndex + dir + searchHits.length) % searchHits.length;
        focusHit(searchIndex);
    }

    if (searchBtn && searchBar) {
        searchBtn.addEventListener("click", () => {
            const open = !searchBar.classList.contains("is-open");
            setSearchUI(open);
            if (!open) {
                clearHighlights();
                if (searchInput) searchInput.value = "";
                if (searchMeta) searchMeta.textContent = "0 / 0";
            } else {
                if (searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
            }
        });
    }

    if (searchClose) {
        searchClose.addEventListener("click", () => {
            setSearchUI(false);
            clearHighlights();
            if (searchInput) searchInput.value = "";
            if (searchMeta) searchMeta.textContent = "0 / 0";
        });
    }

    if (searchPrev) searchPrev.addEventListener("click", () => moveHit(-1));
    if (searchNext) searchNext.addEventListener("click", () => moveHit(1));

    if (searchInput) {
        let t = null;
        searchInput.addEventListener("input", () => {
            window.clearTimeout(t);
            t = window.setTimeout(() => rebuildHighlights(searchInput.value), 120);
        });
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                moveHit(e.shiftKey ? -1 : 1);
            } else if (e.key === "Escape") {
                e.preventDefault();
                if (searchClose) searchClose.click();
                else setSearchUI(false);
            }
        });
    }

    function ensurePdfPreviewOrWarn(ext) {
        const e = String(ext || "").toLowerCase().trim();
        if (e === "pdf") return true;
        addBotMessage("pdf 외 다른 확장자는 미리보기가 제공되지 않습니다.");
        return false;
    }

    body.addEventListener("click", async (e) => {
        const copyBtn = e.target && e.target.closest ? e.target.closest(".cb-actbtn--copy") : null;
        if (copyBtn) {
            const msgEl = copyBtn.closest(".cb-msg");
            const text = getCopyTextFromMsg(msgEl);
            const ok = await copyToClipboard(text);
            copyBtn.classList.toggle("is-done", ok);
            window.setTimeout(() => copyBtn.classList.remove("is-done"), 900);
            return;
        }

        const dlBtn = e.target && e.target.closest ? e.target.closest(".cb-actbtn--download") : null;
        if (dlBtn) {
            e.preventDefault();
            e.stopPropagation();
            const url = dlBtn.getAttribute("data-url") || "";
            if (!url) return;
            const a = document.createElement("a");
            a.href = url;
            a.target = "_blank";
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
        }

        const viewBtn = e.target && e.target.closest ? e.target.closest(".cb-actbtn--view") : null;
        if (viewBtn) {
            e.preventDefault();
            e.stopPropagation();
            const url = viewBtn.getAttribute("data-url") || "";
            const ext = viewBtn.getAttribute("data-ext") || "";
            const name = viewBtn.getAttribute("data-name") || "미리보기";
            if (String(ext || "").toLowerCase().trim() !== "pdf") return;

            if (!url) return;
            openViewer(url, name);
            return;
        }

        const refMainBtn = e.target && e.target.closest ? e.target.closest(".cb-refmain") : null;
        if (refMainBtn) {
            e.preventDefault();
            e.stopPropagation();

            const row = refMainBtn.closest(".cb-refrow");
            if (!row) return;

            const url = row.getAttribute("data-url") || "";
            const ext = row.getAttribute("data-ext") || "";
            const name = row.getAttribute("data-name") || "미리보기";

            if (String(ext || "").toLowerCase().trim() !== "pdf") return;
            if (!url) return;

            openViewer(url, name);
            return;
        }

        const refActBtn = e.target && e.target.closest ? e.target.closest(".cb-refact") : null;
        if (refActBtn) {
            e.preventDefault();
            e.stopPropagation();
            const action = refActBtn.getAttribute("data-action") || "";
            const row = refActBtn.closest(".cb-refrow");

            if (action === "preview") {
                if (!row) return;
                const url = row.getAttribute("data-url") || "";
                const ext = row.getAttribute("data-ext") || "";
                const name = row.getAttribute("data-name") || "미리보기";

                if (!ensurePdfPreviewOrWarn(ext)) return;
                if (!url) return;

                openViewer(url, name);
                return;
            }

            if (action === "download") {
                const url = refActBtn.getAttribute("data-url") || (row ? row.getAttribute("data-url") : "") || "";
                const filename = refActBtn.getAttribute("data-filename") || (row ? row.getAttribute("data-name") : "") || "document.pdf";

                if (!url) return;

                try {
                    await forceDownloadFile(url, filename);
                } catch (err) {
                    addBotMessage(err && err.message ? String(err.message) : "다운로드 중 오류가 발생했습니다.");
                }
                return;
            }


        }

        const refsToggle = e.target && e.target.closest ? e.target.closest(".cb-refs__toggle") : null;
        if (refsToggle) {
            e.preventDefault();
            e.stopPropagation();
            const wrap = refsToggle.closest(".cb-refs");
            if (!wrap) return;
            const more = wrap.querySelector(".cb-refs__more");
            if (!more) return;

            const open = refsToggle.getAttribute("data-open") === "true";
            const nextOpen = !open;
            refsToggle.setAttribute("data-open", nextOpen ? "true" : "false");

            if (nextOpen) {
                more.style.display = "flex";
                refsToggle.textContent = "접기";
            } else {
                more.style.display = "none";
                const n = Number(refsToggle.getAttribute("data-morecount") || "0") || 0;
                refsToggle.textContent = `+${n}개 더보기`;
            }
            scrollToBottom();
            return;
        }

        const qBtn = e.target && e.target.closest ? e.target.closest(".cb-fileqbtn") : null;
        if (qBtn) {
            e.preventDefault();
            e.stopPropagation();

            if (qBtn.hasAttribute("disabled")) return;
            const action = qBtn.getAttribute("data-action") || "";
            const msgEl = qBtn.closest(".cb-msg");
            const filename = msgEl ? (msgEl.getAttribute("data-filename") || msgEl.getAttribute("data-copytext") || "") : "";
            const name = String(filename || "").trim();
            if (!name) return;

            if (msgEl && msgEl.classList.contains("cb-msg--upload-progress")) return;

            if (action === "summary") {
                startSummaryToChat(name);
                return;
            }
            if (action === "question") {
                setSelectedDocument({ name });
                input.focus();
                return;
            }
        }
    });

    const firstMeta = body.querySelector(".cb-msg--bot .cb-meta");
    if (firstMeta && !firstMeta.textContent) firstMeta.textContent = formatTime(new Date());

    ensureResearchTag();
    ensureTemplateTag();
    ensureDocTag();

    setResearchMode(false);
    setTemplate(null);
    setSelectedDocument(null);

    input.focus();
    scrollToBottom();
    autoResizeInput();
});