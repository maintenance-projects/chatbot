document.addEventListener("DOMContentLoaded", () => {
    const widget = document.getElementById("cbWidget");
    const body = document.getElementById("cbBody");
    const input = document.getElementById("cbInput");
    const sendBtn = document.getElementById("cbSend");

    if (!body || !input || !sendBtn) return;

    const defaultPlaceholder = (input.getAttribute("placeholder") || input.placeholder || "").trim();

    const plusBtn = document.getElementById("cbPlus");
    const pop = document.getElementById("cbPop");
    const actionUpload = document.getElementById("cbActionUpload");
    const actionPrint = document.getElementById("cbActionPrint");
    const fileInput = document.getElementById("cbFileInput");

    let isResearchMode = false;
    let researchTag = null;

    const MAX_HEIGHT = 250;

    function ensureResearchTag() {
        if (researchTag) return researchTag;
        if (!plusBtn || !plusBtn.parentElement) return null;

        researchTag = document.createElement("button");
        researchTag.type = "button";
        researchTag.id = "cbResearchTag";
        researchTag.setAttribute("aria-pressed", "false");
        researchTag.innerHTML = `
                                    <img src="/img/ic-research-mini.png" id="miniIcon" />
                                    <span class="cb-rch__label">리서치</span>
                                    <span class="cb-rch__x" aria-hidden="true">×</span>
                                `;

        researchTag.addEventListener("click", (e) => {
            e.preventDefault();
            setResearchMode(false);
            input.focus();
        });

        plusBtn.insertAdjacentElement("afterend", researchTag);
        researchTag.style.display = "none";
        return researchTag;
    }

    function setResearchMode(on) {
        isResearchMode = !!on;

        const tag = ensureResearchTag();

        if (tag) {
            tag.style.display = isResearchMode ? "" : "none";
            tag.setAttribute("aria-pressed", isResearchMode ? "true" : "false");
        }

        if (input) {
            if (isResearchMode) input.placeholder = "디테일한 보고서를 작성해 주세요.";
            else input.placeholder = defaultPlaceholder;
        }

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

    function normalizeBubbleText(text) {
        let s = String(text ?? "");
        s = s.replace(/\r\n/g, "\n");
        s = s.replace(/^[ \t]*\n+/, "");
        return s;
    }

    function autoResizeInput() {
        if (!input) return;

        input.style.height = "auto";

        const nextHeight = Math.min(input.scrollHeight, MAX_HEIGHT);
        input.style.height = `${nextHeight}px`;

        if (input.scrollHeight > MAX_HEIGHT) {
            input.style.overflowY = "auto";
        } else {
            input.style.overflowY = "hidden";
        }
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

    //dev
    function addBotMessage(text, type) {
      const now = formatTime(new Date());
      const clean = normalizeBubbleText(text);

      const html = `
        <div class="cb-msg cb-msg--bot">
          <div class="cb-avatar">
            <img class="cb-avatar__img" src="/img/ic-chatbot.png" alt="챗봇" />
          </div>
          <div class="cb-bubble">
            <div class="cb-bubble__text"><pre>${escapeHtml(clean)}</pre></div>
            <div class="cb-meta">${now}</div>
          </div>
        </div>
      `;

      body.insertAdjacentHTML("beforeend", html);
      const el = body.lastElementChild;   // 추가
      scrollToBottom();
      if (isSearchOpen() && searchInput && searchInput.value.trim()) rebuildHighlights(searchInput.value);
      return el;                          // 추가
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

    //dev
    async function sendMessage() {
      const msg = String(input.value || "").trim();
      if (!msg) return;

      addUserMessage(msg);
      input.value = "";
      autoResizeInput();

      addBotLoading();
      setSending(true);

      const payload = { sessionId, message: msg, deepResearch: isResearchMode ? true : false };

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify(payload),
        });

        if (!res.ok || !res.body) throw new Error("stream failed");

        removeBotLoading();
        const botEl = addBotMessage("", "chat");
        const pre = botEl.querySelector("pre");
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let buffer = "";
        let acc = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE 이벤트는 보통 \n\n 로 구분됨
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const evt of events) {
            const lines = evt.split("\n");
            let eventName = "";
            let data = "";

            for (const line of lines) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              else if (line.startsWith("data:")) data += line.slice(5); // data는 여러 줄일 수 있음
            }

            if (eventName === "delta") {
              acc += data;
              pre.textContent = acc;
              scrollToBottom();
            } else if (eventName === "error") {
              acc += "\n" + data;
              pre.textContent = acc;
              scrollToBottom();
            } else if (eventName === "done") {
              // 끝
            }
          }
        }
      } catch (e) {
        pre.textContent = "요청 처리 중 오류가 발생했습니다.";
      } finally {
        setSending(false);
        input.focus();
        autoResizeInput();
      }
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
    setResearchMode(false);

    input.focus();
    scrollToBottom();
    autoResizeInput();

    if (fileInput) {
        fileInput.setAttribute("accept", ".pdf,.hwp,.hwpx,.xls,.xlsx,.ppt,.pptx,.csv,.doc,.docx,.txt,.m4a");
    }

    const allowedExt = new Set(["pdf", "hwp", "hwpx", "xls", "xlsx", "ppt", "pptx", "csv", "doc", "docx", "txt", "m4a"]);
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

    //dev
    async function uploadFile(file, onDone) {
      if (!file) { onDone?.(); return; }

      if (!isAllowedFile(file)) {
        addBotMessage("업로드할 수 없는 파일 형식입니다. (가능: PDF, 한글(HWP/HWPX), 엑셀(XLS/XLSX/CSV), PPT(PPT/PPTX), 워드(DOC/DOCX), TXT)", "chat");
        onDone?.();
        return;
      }

      addUserMessage(`첨부파일 선택: ${file.name}`);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("sessionId", sessionId);
      formData.append("deepResearch", isResearchMode ? true : false);

      addBotLoading();
      setSending(true);
      removeBotLoading();

      // 진행상황을 한 곳에 누적해서 보여주고 싶으면 botEl을 잡아두는 게 좋아요
      const botEl = addBotMessage("처리 시작…", "file");
      const pre = botEl?.querySelector?.("pre"); // addBotMessage가 element 반환하도록 해두면 best

      // progress UI(있으면) 업데이트용 (없으면 무시됨)
      const bar = document.querySelector("#uploadProgressBar");     // <progress id="uploadProgressBar" max="100"></progress>
      const label = document.querySelector("#uploadProgressLabel"); // <div id="uploadProgressLabel"></div>

      let buffer = "";
      let accLog = "";
      let finalRendered = false;

      const appendLog = (line) => {
        // 너무 길어지면 최근 N줄만 유지하는 식으로 제한해도 좋음
        accLog += (accLog ? "\n" : "") + line;
        if (pre) pre.textContent = accLog;
        scrollToBottom();
      };

      const updateProgress = (obj) => {
        const percent = (typeof obj.percent === "number") ? obj.percent : null;
        const stage = obj.stage ?? "";
        const msg = obj.message ?? "";

        if (bar && percent != null) bar.value = percent;
        if (label) label.textContent = `${percent ?? ""}% ${stage} - ${msg}`.trim();

        // 채팅에도 로그 남기기(원하면 끄기)
        const line = `${percent ?? ""}% [${stage}] ${msg}`.replace(/\s+/g, " ").trim();
        if (line) appendLog(line);
      };

      const renderFinal = (obj) => {
        if (finalRendered) return;
        // summary는 길고 보기 좋으니 summary 중심으로 출력
        if (obj.summary) addBotMessage(String(obj.summary), "file");
        if (obj.duration_seconds != null) {
          addBotMessage(`처리 완료 (소요시간: ${obj.duration_seconds}s)`, "file");
        }

        // transcript는 매우 길 수 있으니: 기본은 “원문 길이”만 표시
        if (obj.transcript) {
          addBotMessage(`원문(Transcript) ${obj.transcript.length}자 생성됨 (필요하면 '원문 보기' UI로 연결 추천)`, "file");
          // 원문을 바로 찍고 싶으면 아래 주석 해제:
          // addBotMessage(String(obj.transcript), "file");
        }

        finalRendered = true;
      };

      try {
        const res = await fetch("/api/chat/upload/stream", {
          method: "POST",
          body: formData
        });

        if (!res.ok || !res.body) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `파일 업로드 실패 (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // ✅ NDJSON: 줄 단위로 자르기
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // 마지막은 미완성 라인일 수 있음

          for (const line of lines) {
            const s = line.trim();
            if (!s) continue;

            let obj;
            try {
              obj = JSON.parse(s);
            } catch (e) {
              // 서버가 가끔 빈 문자열/깨진 조각 보내면 그냥 무시
              continue;
            }

            // 1) progress 이벤트
            if (obj.percent != null || obj.stage || obj.message) {
              updateProgress(obj);
            }

            // 2) 최종 결과 이벤트 (summary/transcript)
            if (obj.summary || obj.transcript || obj.duration_seconds != null) {
              renderFinal(obj);
            }
          }
        }

        // 스트림이 끝났는데 마지막 버퍼에 JSON이 남아있을 수도 있으니 한 번 더 시도(옵션)
        const tail = buffer.trim();
        if (tail) {
          try {
            const obj = JSON.parse(tail);
            if (obj.percent != null || obj.stage || obj.message) updateProgress(obj);
            if (obj.summary || obj.transcript || obj.duration_seconds != null) renderFinal(obj);
          } catch {}
        }

        if (!finalRendered) {
          addBotMessage("처리는 완료됐지만 결과(summary/transcript)를 받지 못했습니다.", "chat");
        }

      } catch (e) {
        addBotMessage(e?.message ? String(e.message) : "파일 업로드 중 오류가 발생했습니다.", "chat");
      } finally {
        setSending(false);
        input.focus();
        autoResizeInput();
        onDone?.();
      }
    }

    function uploadFiles(fileList) {
        const all = Array.from(fileList || []);
        if (all.length === 0) return;

        const allowed = all.filter(isAllowedFile);
        const blocked = all.filter((f) => !isAllowedFile(f));

        if (blocked.length > 0) {
            const names = blocked.map((f) => f.name).join(", ");
            addBotMessage(`업로드 불가 파일이 제외되었습니다: ${names}`, "chat");
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
            const dt = e.dataTransfer;
            if (!dt) return false;

            if (dt.items && dt.items.length) {
                return Array.from(dt.items).some((it) => it && it.kind === "file");
            }

            const types = dt.types;
            if (!types) return false;
            const arr = Array.from(types);
            return arr.includes("Files") || arr.includes("application/x-moz-file");
        }

        function setDropEffect(e) {
            if (!e.dataTransfer) return;
            try {
                e.dataTransfer.dropEffect = "copy";
            } catch (_) { }
        }

        let dragCounter = 0;

        function setDragUI(on) {
            document.documentElement.classList.toggle("is-dragover", on);
        }

        document.addEventListener("dragenter", (e) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
            dragCounter++;
            setDropEffect(e);
            setDragUI(true);
        }, true);

        document.addEventListener("dragleave", (e) => {
            if (!isFileDrag(e)) return;
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                setDragUI(false);
            }
        }, true);

        document.addEventListener("dragover", (e) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
            setDropEffect(e);
        }, true);

        document.addEventListener("drop", (e) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            setDragUI(false);
            const files = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files : null;
            if (files && files.length) uploadFiles(files);
        }, true);
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
            .cb-bubble__text{ font-size:14px; line-height:1.45; white-space:pre-wrap; word-break:break-word; overflow-wrap:anywhere; }
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

    document.addEventListener("click", (e) => {
        const btn = e.target && e.target.closest ? e.target.closest("#cbActionUpResearch") : null;
        if (!btn) return;
        e.preventDefault();
        closePop();
        setResearchMode(!isResearchMode);
        input.focus();
    }, true);

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