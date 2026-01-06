document.addEventListener("DOMContentLoaded", () => {
    const widget = document.getElementById("cbWidget");
    const body = document.getElementById("cbBody");
    const input = document.getElementById("cbInput");
    const sendBtn = document.getElementById("cbSend");

    if (!body || !input || !sendBtn) return;

    const sessionId = "ultari01";

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

    function addUserMessage(text) {
        const now = formatTime(new Date());
        const html = `
      <div class="cb-msg cb-msg--user">
        <div class="cb-bubble">
          <div class="cb-bubble__text">${escapeHtml(text)}</div>
          <div class="cb-meta">${now}</div>
        </div>
      </div>
    `;
        body.insertAdjacentHTML("beforeend", html);
        scrollToBottom();
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
    }

    function addBotMessage(text) {
        const now = formatTime(new Date());
        const html = `
      <div class="cb-msg cb-msg--bot">
        <div class="cb-avatar">
          <img class="cb-avatar__img" src="/img/ic-chatbot.png" alt="챗봇" />
        </div>
        <div class="cb-bubble">
          <div class="cb-bubble__text">${escapeHtml(text)}</div>
          <div class="cb-meta">${now}</div>
        </div>
      </div>
    `;
        body.insertAdjacentHTML("beforeend", html);
        scrollToBottom();
        if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
    }

    function addBotLoading() {
        removeBotLoading();
        const html = `
      <div class="cb-msg cb-msg--bot cb-msg--loading" id="cbLoadingBubble">
        <div class="cb-avatar">
          <img class="cb-avatar__img" src="/img/ic-chatbot.png" alt="챗봇" />
        </div>
        <div class="cb-bubble">
          <div class="cb-bubble__text">
            <span class="cb-typing"><i></i><i></i><i></i></span>
          </div>
          <div class="cb-meta"></div>
        </div>
      </div>
    `;
        body.insertAdjacentHTML("beforeend", html);
        scrollToBottom();
    }

    function removeBotLoading() {
        const el = document.getElementById("cbLoadingBubble");
        if (el) el.remove();
    }

    function setSending(isSending) {
        sendBtn.disabled = isSending;
        input.disabled = isSending;
        if (widget) widget.classList.toggle("is-sending", isSending);
    }

    function sendMessage() {
        const msg = (input.value || "").trim();
        if (!msg) return;

        addUserMessage(msg);
        input.value = "";

        addBotLoading();
        setSending(true);

        const payload = { sessionId, message: msg };

        $.ajax({
            url: "/api/chat",
            type: "POST",
            contentType: "application/json; charset=UTF-8",
            data: JSON.stringify(payload),
            dataType: "json",
            success: function (d) {
                removeBotLoading();
                const answer = (d && (d.answer ?? d.response ?? d.message)) ? String(d.answer ?? d.response ?? d.message) : "";
                addBotMessage(answer || "응답을 받았지만 표시할 내용이 없습니다.");
            },
            error: function (xhr) {
                removeBotLoading();
                let text = "요청 처리 중 오류가 발생했습니다.";
                try {
                    const json = xhr.responseJSON;
                    if (json && (json.message || json.error)) text = String(json.message || json.error);
                    else if (xhr.responseText) text = String(xhr.responseText);
                } catch (e) { }
                addBotMessage(text);
            },
            complete: function () {
                removeBotLoading();
                setSending(false);
                input.focus();
            }
        });
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

    const firstMeta = body.querySelector(".cb-msg--bot .cb-meta");
    if (firstMeta && !firstMeta.textContent) firstMeta.textContent = formatTime(new Date());

    input.focus();
    scrollToBottom();

    const plusBtn = document.getElementById("cbPlus");
    const pop = document.getElementById("cbPop");
    const actionUpload = document.getElementById("cbActionUpload");
    const actionPrint = document.getElementById("cbActionPrint");
    const fileInput = document.getElementById("cbFileInput");

    if (fileInput) {
        fileInput.setAttribute("accept", ".pdf,.hwp,.hwpx,.xls,.xlsx,.ppt,.pptx,.csv,.doc,.docx,.txt");
    }

    const allowedExt = new Set(["pdf", "hwp", "hwpx", "xls", "xlsx", "ppt", "pptx", "csv", "doc", "docx", "txt"]);
    const blockedExt = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "heic", "svg"]);

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

    function uploadFile(file, onDone) {
        if (!file) {
            if (typeof onDone === "function") onDone();
            return;
        }

        if (!isAllowedFile(file)) {
            addBotMessage("업로드할 수 없는 파일 형식입니다. (가능: PDF, 한글(HWP/HWPX), 엑셀(XLS/XLSX/CSV), PPT(PPT/PPTX), 워드(DOC/DOCX), TXT)");
            if (typeof onDone === "function") onDone();
            return;
        }

        addUserMessage(`첨부파일 선택: ${file.name}`);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("sessionId", sessionId);

        addBotLoading();
        setSending(true);

        $.ajax({
            url: "/api/chat/upload",
            type: "POST",
            data: formData,
            processData: false,
            contentType: false,
            success: function (d) {
                removeBotLoading();
                const msg = (d && (d.message ?? d.answer ?? d.response))
                    ? String(d.message ?? d.answer ?? d.response)
                    : "파일 업로드 완료";
                addBotMessage(msg);
            },
            error: function (xhr) {
                removeBotLoading();
                let text = "파일 업로드 중 오류가 발생했습니다.";
                try {
                    if (xhr.responseText) text = String(xhr.responseText);
                } catch (e) { }
                addBotMessage(text);
            },
            complete: function () {
                removeBotLoading();
                setSending(false);
                input.focus();
                if (typeof onDone === "function") onDone();
            }
        });
    }

    function uploadFiles(fileList) {
        const all = Array.from(fileList || []);
        if (all.length === 0) return;

        const allowed = all.filter(isAllowedFile);
        const blocked = all.filter((f) => !isAllowedFile(f));

        if (blocked.length > 0) {
            const names = blocked.map((f) => f.name).join(", ");
            addBotMessage(`업로드 불가 파일이 제외되었습니다: ${names}`);
        }

        if (allowed.length === 0) return;

        let idx = 0;
        const next = () => {
            if (idx >= allowed.length) return;
            const f = allowed[idx++];
            uploadFile(f, next);
        };
        next();
    }

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            if (!fileInput.files || fileInput.files.length === 0) return;
            uploadFiles(fileInput.files);
            fileInput.value = "";
        });

        function isFileDrag(e) {
            const types = e.dataTransfer?.types;
            if (!types) return false;
            return Array.from(types).includes("Files");
        }

        function setDropEffect(e) {
            if (!e.dataTransfer) return;
            e.dataTransfer.dropEffect = "move";
        }

        let dragCounter = 0;

        function setDragUI(on) {
            document.documentElement.classList.toggle("is-dragover", on);
        }

        document.addEventListener(
            "dragenter",
            (e) => {
                if (!isFileDrag(e)) return;
                dragCounter++;
                setDropEffect(e);
                setDragUI(true);
            },
            true
        );

        document.addEventListener(
            "dragleave",
            (e) => {
                if (!isFileDrag(e)) return;
                dragCounter--;
                if (dragCounter <= 0) {
                    dragCounter = 0;
                    setDragUI(false);
                }
            },
            true
        );

        document.addEventListener(
            "dragover",
            (e) => {
                if (!isFileDrag(e)) return;
                e.preventDefault();
                setDropEffect(e);
            },
            true
        );

        document.addEventListener(
            "drop",
            (e) => {
                if (!isFileDrag(e)) return;
                e.preventDefault();
                dragCounter = 0;
                setDragUI(false);
                uploadFiles(e.dataTransfer.files);
            },
            true
        );
    }

    function openPop() {
        if (!pop || !plusBtn) return;
        pop.classList.add("is-open");
        pop.setAttribute("aria-hidden", "false");
        plusBtn.setAttribute("aria-expanded", "true");
    }

    function closePop() {
        if (!pop || !plusBtn) return;
        pop.classList.remove("is-open");
        pop.setAttribute("aria-hidden", "true");
        plusBtn.setAttribute("aria-expanded", "false");
    }

    function togglePop() {
        if (!pop) return;
        if (pop.classList.contains("is-open")) closePop();
        else openPop();
    }

    if (plusBtn && pop) {
        plusBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePop();
        });

        document.addEventListener("click", (e) => {
            if (!pop.classList.contains("is-open")) return;
            const inside = pop.contains(e.target) || plusBtn.contains(e.target);
            if (!inside) closePop();
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closePop();
        });
    }

    if (actionUpload && fileInput) {
        actionUpload.addEventListener("click", () => {
            closePop();
            fileInput.click();
        });
    }

    if (actionPrint) {
        actionPrint.addEventListener("click", () => {
            closePop();
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
            .cb-bubble__text{ font-size:14px; line-height:1.45; white-space:pre-wrap; word-break:break-word; }
            .cb-meta{ margin-top:6px; font-size:11px; opacity:.7; }
            .cb-chips,.cb-msg--loading{ display:none !important; }
          </style>
        </head>
        <body>
          <div class="wrap">${chatHtml}</div>
          <script>window.onload=()=>{window.focus();window.print();};</script>
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
            if (!el.getAttribute("data-raw")) el.setAttribute("data-raw", el.innerHTML);

            const plain = el.textContent || "";
            re.lastIndex = 0;
            if (!re.test(plain)) continue;

            const raw = el.getAttribute("data-raw") || el.innerHTML;
            re.lastIndex = 0;
            el.innerHTML = raw.replace(re, (m) => `<mark class="cb-mark">${m}</mark>`);

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
