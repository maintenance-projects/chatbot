document.addEventListener("DOMContentLoaded", () => {
    const widget = document.getElementById("cbWidget");
    const body = document.getElementById("cbBody");
    const input = document.getElementById("cbInput");
    const sendBtn = document.getElementById("cbSend");
    const inputWrap = document.getElementById("cbInputWrap");

    if (!body || !input || !sendBtn || !inputWrap) return;

    let chipRow = document.getElementById("cbChipRow");
    if (!chipRow) {
        chipRow = document.createElement("div");
        chipRow.className = "cb-chiprow";
        chipRow.id = "cbChipRow";
        chipRow.setAttribute("aria-hidden", "true");
        const inputbar = inputWrap.querySelector(".cb-inputbar");
        if (inputbar) inputbar.insertAdjacentElement("afterend", chipRow);
        else inputWrap.appendChild(chipRow);
    }

    const defaultPlaceholder = (input.getAttribute("placeholder") || input.placeholder || "").trim();

    const plusBtn = document.getElementById("cbPlus");
    const pop = document.getElementById("cbPop");
    const actionUpload = document.getElementById("cbActionUpload");
    const actionPrint = document.getElementById("cbActionPrint");
    const actionSelect = document.getElementById("cbActionSelect");
    const actionUpResearch = document.getElementById("cbActionUpResearch");
    const fileInput = document.getElementById("cbFileInput");

    const tray = document.getElementById("cbTplTray");
    const trayClose = document.getElementById("cbTplTrayClose");
    const trayBody = document.getElementById("cbTplTrayBody");

    let isResearchMode = false;
    let researchTag = null;

    let selectedTemplate = null;
    let templateTag = null;

    let pendingFile = null;
    let fileTag = null;

    const MAX_HEIGHT = 250;

    const allowedExt = new Set(["pdf", "hwp", "hwpx", "xls", "xlsx", "ppt", "pptx", "csv", "doc", "docx", "txt", "m4a"]);
    const blockedExt = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "heic", "svg"]);

    function updateChipRow() {
        const hasAny =
            (researchTag && researchTag.style.display !== "none") ||
            (templateTag && templateTag.style.display !== "none") ||
            (fileTag && fileTag.style.display !== "none");

        chipRow.classList.toggle("is-open", !!hasAny);
        chipRow.setAttribute("aria-hidden", hasAny ? "false" : "true");
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

    function ensureFileTag() {
        if (fileTag) return fileTag;

        fileTag = document.createElement("button");
        fileTag.type = "button";
        fileTag.id = "cbFileTag";
        fileTag.setAttribute("aria-pressed", "false");
        fileTag.innerHTML = `
            <img src="/img/ic-file.png" class="cb-tag__icon" />
            <span class="cb-filetag__label"></span>
            <span class="cb-filetag__x" aria-hidden="true">×</span>
        `;

        fileTag.addEventListener("click", (e) => {
            e.preventDefault();
            setPendingFile(null);
            input.focus();
        });

        ensureTemplateTag();
        mountChip(fileTag);
        fileTag.style.display = "none";
        updateChipRow();
        return fileTag;
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
            updateChipRow();
            return;
        }

        tag.style.display = "";
        tag.setAttribute("aria-pressed", "true");
        const labelEl = tag.querySelector(".cb-tpltag__label");
        if (labelEl) labelEl.textContent = selectedTemplate.name || "양식";
        updateChipRow();
    }

    function setPendingFile(file) {
        if (file && isResearchMode) setResearchMode(false);

        pendingFile = file || null;

        const tag = ensureFileTag();
        if (!tag) return;

        if (!pendingFile) {
            tag.style.display = "none";
            tag.setAttribute("aria-pressed", "false");
            const labelEl = tag.querySelector(".cb-filetag__label");
            if (labelEl) labelEl.textContent = "";
            updateChipRow();
            return;
        }

        tag.style.display = "";
        tag.setAttribute("aria-pressed", "true");
        const labelEl = tag.querySelector(".cb-filetag__label");
        if (labelEl) labelEl.textContent = pendingFile.name || "파일";
        updateChipRow();
    }

    function setResearchMode(on) {
        const next = !!on;

        if (next) {
            setTemplate(null);
            setPendingFile(null);
        }

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

    function pad2(n) {
        return String(n).padStart(2, "0");
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
        const ext = getExt(file.name);
        if (!ext) return false;
        if (blockedExt.has(ext)) return false;
        return allowedExt.has(ext);
    }

    function addUserMessage(text) {
        const now = formatTime(new Date());
        const html = `
            <div class="cb-msg cb-msg--user">
                <div class="cb-bubble">
                    <div class="cb-bubble__text"><pre>${escapeHtml(text)}</pre></div>
                    <div class="cb-meta">${now}</div>
                </div>
            </div>
        `;
        body.insertAdjacentHTML("beforeend", html);
        scrollToBottom();
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
    }

    function addUserFileMessage(file) {
        const now = formatTime(new Date());
        const name = file && file.name ? String(file.name) : "파일";
        const ext = getExt(name);
        const badge = ext ? ext.toUpperCase() : "FILE";

        const html = `
            <div class="cb-msg cb-msg--user">
                <div class="cb-bubble---file">
                    <div class="cb-bubble__text">
                        <div class="cb-filecard" role="group" aria-label="첨부파일">
                            <img src="/img/ic-file.png" class="cb-filecard__icon" alt="" />
                            <div class="cb-filecard__meta">
                                <div class="cb-filecard__name">${escapeHtml(name)}</div>
                                <div class="cb-filecard__badge">${escapeHtml(badge)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        body.insertAdjacentHTML("beforeend", html);
        scrollToBottom();
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
    }

    function addBotMessage(text) {
        const now = formatTime(new Date());
        const clean = normalizeBubbleText(text);

        const html = `
            <div class="cb-msg cb-msg--bot">
                <div class="cb-avatar">
                    <img class="cb-avatar__img" src="/img/ic-chatbot.png" alt="챗봇" />
                </div>
                <div class="cb-bubble">
                    <div class="cb-bubble__text" data-raw="${escapeHtml(clean)}"><pre>${renderRichText(clean)}</pre></div>
                    <div class="cb-meta">${now}</div>
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

    function addBotStreamLoadingMessage() {
        const id = `cbStream_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const html = `
            <div class="cb-msg cb-msg--bot cb-msg--streaming" data-stream-id="${id}">
                <div class="cb-avatar">
                    <img class="cb-avatar__img" src="/img/ic-chatbot.png" alt="챗봇" />
                </div>
                <div class="cb-bubble">
                    <div class="cb-bubble__text" data-raw="">
                        <span class="cb-typing"><i></i><i></i><i></i></span>
                        <pre style="display:none" data-raw=""></pre>
                    </div>
                    <div class="cb-meta"></div>
                </div>
            </div>
        `;
        body.insertAdjacentHTML("beforeend", html);
        const msgEl = body.querySelector(`.cb-msg[data-stream-id="${id}"]`);
        const textEl = msgEl ? msgEl.querySelector(".cb-bubble__text") : null;
        const preEl = msgEl ? msgEl.querySelector(".cb-bubble__text pre") : null;
        const metaEl = msgEl ? msgEl.querySelector(".cb-meta") : null;
        const typingEl = msgEl ? msgEl.querySelector(".cb-typing") : null;
        scrollToBottom();
        return { msgEl, textEl, preEl, metaEl, typingEl, started: false };
    }

    function startStreaming(handle) {
        if (!handle || handle.started) return;
        handle.started = true;
        if (handle.typingEl) handle.typingEl.style.display = "none";
        if (handle.preEl) handle.preEl.style.display = "block";
        if (handle.preEl && handle.preEl.getAttribute("data-raw") == null) handle.preEl.setAttribute("data-raw", "");
        if (handle.textEl && handle.textEl.getAttribute("data-raw") == null) handle.textEl.setAttribute("data-raw", "");
        scrollToBottom();
    }

    function appendStreamText(handle, chunk) {
        if (!handle || !handle.preEl) return;

        const prev = handle.preEl.getAttribute("data-raw") || "";
        const next = prev + String(chunk || "");
        handle.preEl.setAttribute("data-raw", next);

        if (handle.textEl) handle.textEl.setAttribute("data-raw", renderRichText(next));

        handle.preEl.innerHTML = renderRichText(next);

        scrollToBottom();
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
    }

    function finalizeStream(handle) {
        if (!handle || !handle.metaEl) return;
        if (!handle.metaEl.textContent) handle.metaEl.textContent = formatTime(new Date());

        if (handle && handle.msgEl) {
            handle.msgEl.classList.remove("cb-msg--streaming");
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

    async function streamEventText(url, options, onText, onFirstToken) {
        const res = await fetch(url, options);

        if (!res.ok) {
            let t = "";
            try { t = await res.text(); } catch (e) { }
            const err = new Error(t || "요청 처리 중 오류가 발생했습니다.");
            err.status = res.status;
            throw err;
        }

        if (!res.body) {
            let t = "";
            try { t = await res.text(); } catch (e) { }
            if (t) {
                if (typeof onFirstToken === "function") onFirstToken();
                onText(t);
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

                const { data } = parseSseFrame(frame);

                if (data === "[DONE]") return;
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
                        onText(data);
                        continue;
                    }

                    const content = j && j.choices && j.choices[0] && j.choices[0].delta
                        ? j.choices[0].delta.content
                        : null;

                    if (typeof content === "string" && content.length) {
                        if (first) {
                            first = false;
                            if (typeof onFirstToken === "function") onFirstToken();
                        }
                        onText(content);
                    }
                } else {
                    if (first) {
                        first = false;
                        if (typeof onFirstToken === "function") onFirstToken();
                    }
                    onText(data);
                }
            }
        }
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
        tray.classList.add("is-open");
        tray.setAttribute("aria-hidden", "false");
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

    function sendTextMessage(msg) {
        closeTray();
        addUserMessage(msg);
        input.value = "";
        autoResizeInput();

        setSending(true);

        const handle = addBotStreamLoadingMessage();

        const payload = {
            sessionId,
            message: msg,
            deepResearch: isResearchMode ? true : false,
            templateKey: selectedTemplate ? selectedTemplate.key : null
        };

        streamEventText("/api/chat/stream", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=UTF-8",
                "Accept": "text/event-stream"
            },
            body: JSON.stringify(payload),
            credentials: "same-origin"
        }, (t) => {
            startStreaming(handle);
            appendStreamText(handle, t);
        }, () => startStreaming(handle))
            .then(() => {
                startStreaming(handle);
                finalizeStream(handle);
                const raw = handle.preEl ? (handle.preEl.getAttribute("data-raw") || "") : "";
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

    function uploadFile(file, messageText, onDone) {
        if (!file) {
            if (typeof onDone === "function") onDone();
            return;
        }

        if (!isAllowedFile(file)) {
            addBotMessage("업로드할 수 없는 파일 형식입니다. (가능: PDF, 한글(HWP/HWPX), 엑셀(XLS/XLSX/CSV), PPT(PPT/PPTX), 워드(DOC/DOCX), TXT)");
            if (typeof onDone === "function") onDone();
            return;
        }

        closeTray();

        const msg = String(messageText || "").trim();

        addUserFileMessage(file);
        if (msg) addUserMessage(msg);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("sessionId", sessionId);
        formData.append("deepResearch", isResearchMode ? true : false);
        formData.append("templateKey", selectedTemplate ? selectedTemplate.key : "");
        formData.append("message", msg);

        setSending(true);

        const handle = addBotStreamLoadingMessage();

        streamEventText("/api/chat/upload/stream", {
            method: "POST",
            headers: { "Accept": "text/event-stream" },
            body: formData,
            credentials: "same-origin"
        }, (t) => {
            startStreaming(handle);
            appendStreamText(handle, t);
        }, () => startStreaming(handle))
            .then(() => {
                startStreaming(handle);
                finalizeStream(handle);
                const raw = handle.preEl ? (handle.preEl.getAttribute("data-raw") || "") : "";
                if (!raw.trim()) appendStreamText(handle, "파일 업로드 완료");
            })
            .catch((err) => {
                if (handle && handle.msgEl) handle.msgEl.remove();
                addBotMessage(err && err.message ? String(err.message) : "파일 업로드 중 오류가 발생했습니다.");
            })
            .finally(() => {
                setSending(false);
                input.focus();
                autoResizeInput();
                if (typeof onDone === "function") onDone();
            });
    }

    function sendMessage() {
        const msg = String(input.value || "").trim();
        const hasFile = !!pendingFile;

        if (!msg && !hasFile) return;

        if (hasFile) {
            const f = pendingFile;
            setPendingFile(null);

            input.value = "";
            autoResizeInput();

            uploadFile(f, msg, () => {
                input.focus();
                autoResizeInput();
            });
            return;
        }

        sendTextMessage(msg);
    }

    sendBtn.addEventListener("click", (e) => {
        e.preventDefault();
        sendMessage();
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    input.addEventListener("input", () => {
        autoResizeInput();
    });

    const firstMeta = body.querySelector(".cb-msg--bot .cb-meta");
    if (firstMeta && !firstMeta.textContent) firstMeta.textContent = formatTime(new Date());

    ensureResearchTag();
    ensureTemplateTag();
    ensureFileTag();
    setResearchMode(false);
    setTemplate(null);
    setPendingFile(null);

    input.focus();
    scrollToBottom();
    autoResizeInput();

    if (fileInput) {
        fileInput.setAttribute("accept", ".pdf,.hwp,.hwpx,.xls,.xlsx,.ppt,.pptx,.csv,.doc,.docx,.txt,.m4a");
    }

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            const files = fileInput.files ? Array.from(fileInput.files) : [];
            fileInput.value = "";
            if (!files.length) return;

            const first = files.find(isAllowedFile);
            const blocked = files.filter((f) => !isAllowedFile(f));

            if (blocked.length > 0) {
                const names = blocked.map((f) => f.name).join(", ");
                addBotMessage(`업로드 불가 파일이 제외되었습니다: ${names}`);
            }

            if (!first) return;

            setPendingFile(first);
            closePop();
            closeTray();
            input.focus();
        });
    }

    if (plusBtn && pop) {
        plusBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
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
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closePop();
                closeTray();
            }
        });
    }

    if (actionUpload && fileInput) {
        actionUpload.addEventListener("click", () => {
            closePop();
            closeTray();
            fileInput.click();
        });
    }

    if (actionSelect) {
        actionSelect.addEventListener("click", () => {
            closePop();
            toggleTray();
            if (!isTrayOpen()) input.focus();
        });
    }

    if (actionUpResearch) {
        actionUpResearch.addEventListener("click", (e) => {
            e.preventDefault();
            closePop();
            closeTray();
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
        trayBody.addEventListener("click", (e) => {
            const btn = e.target && e.target.closest ? e.target.closest(".cb-tpl") : null;
            if (!btn) return;

            const nameEl = btn.querySelector(".cb-tpl__name");
            const key = btn.getAttribute("data-template") || "";
            const name = nameEl ? (nameEl.textContent || "").trim() : "양식";

            setTemplate({ key, name });

            closeTray();
            input.focus();
        });
    }

    if (actionPrint) {
        actionPrint.addEventListener("click", () => {
            closePop();
            closeTray();
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
                    .wrap{ max-width: 720px; margin: 0 auto; }
                    .cb-divider{ text-align:center; margin: 12px 0; color:#666; font-size:12px; }
                    .cb-msg{ display:flex; gap:10px; margin:10px 0; }
                    .cb-msg--user{ justify-content:flex-end; }
                    .cb-avatar{ width:34px; height:34px; display:grid; place-items:center; border:1px solid #ddd; border-radius:12px; }
                    .cb-bubble{ max-width:74%; border:1px solid #ddd; border-radius:16px; padding:10px 12px; background:#f3f4f6; }
                    .cb-msg--user .cb-bubble{ background:#2f3a4f; color:#fff; border-color:#2f3a4f; }
                    .cb-bubble__text{ font-size:14px; line-height:1.45; white-space:pre-wrap; word-break:break-word; overflow-wrap:anywhere; }
                    .cb-meta{ margin-top:6px; font-size:11px; opacity:.7; }
                    .cb-msg--loading{ display:none !important; }
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

    function clearHighlights() {
        body.querySelectorAll(".cb-hit").forEach((el) => el.classList.remove("cb-hit"));
        body.querySelectorAll(".cb-bubble__text").forEach((el) => {
            const raw = el.getAttribute("data-raw");
            if (raw != null) el.innerHTML = raw;
        });
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

        const texts = Array.from(body.querySelectorAll(".cb-bubble__text"));

        for (const el of texts) {
            const raw = el.getAttribute("data-raw");
            if (raw == null) el.setAttribute("data-raw", el.innerHTML);

            const plain = el.textContent || "";
            re.lastIndex = 0;
            if (!re.test(plain)) continue;

            const base = el.getAttribute("data-raw") || el.innerHTML;
            re.lastIndex = 0;
            el.innerHTML = base.replace(re, (m) => `<mark class="cb-mark">${m}</mark>`);

            const msg = el.closest(".cb-msg");
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
});
