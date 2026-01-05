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

    if (plusBtn && pop) {
        function openPop() {
            pop.classList.add("is-open");
            pop.setAttribute("aria-hidden", "false");
            plusBtn.setAttribute("aria-expanded", "true");
        }

        function closePop() {
            pop.classList.remove("is-open");
            pop.setAttribute("aria-hidden", "true");
            plusBtn.setAttribute("aria-expanded", "false");
        }

        function togglePop() {
            if (pop.classList.contains("is-open")) closePop();
            else openPop();
        }

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

        if (actionUpload && fileInput) {
            actionUpload.addEventListener("click", () => {
                closePop();
                fileInput.click();
            });

            fileInput.addEventListener("change", () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;

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
                        const msg = (d && (d.message ?? d.answer ?? d.response)) ? String(d.message ?? d.answer ?? d.response) : "파일 업로드 완료";
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
                        fileInput.value = "";
                        input.focus();
                    }
                });
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
    }
});
