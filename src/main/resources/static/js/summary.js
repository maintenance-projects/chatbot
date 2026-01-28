(() => {
    const $ = (id) => document.getElementById(id);

    const elStream = $("sumStream");
    const elStatus = $("sumStatus");
    const elSub = $("sumSub");
    const elProgress = $("sumProgress");
    const btnCopy = $("btnCopy");
    const btnRetry = $("btnRetry");
    const toast = $("sumToast");

    if (!elStream) return;

    let running = false;
    let currentTextPlain = "";
    let currentTextHTML = "";
    let timer = null;

    const escapeHTML = (s) => String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const showToast = (msg) => {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add("is-on");
        window.clearTimeout(showToast._t);
        showToast._t = window.setTimeout(() => toast.classList.remove("is-on"), 1200);
    };

    const setLoading = (on, msg) => {
        if (elProgress) elProgress.style.visibility = on ? "visible" : "hidden";
        if (elStatus) elStatus.textContent = msg || (on ? "요약 생성 중…" : "대화 요약 완료!");
    };

    const parseQuery = () => {
        const sp = new URLSearchParams(location.search);
        const fileName = sp.get("fileName") || sp.get("file") || sp.get("name") || "";
        const sessionId = sp.get("sessionId") || sp.get("sid") || "";
        return {
            fileName: fileName ? decodeURIComponent(fileName) : "",
            sessionId: sessionId ? decodeURIComponent(sessionId) : ""
        };
    };

    const renderStreamHTML = (html) => {
        elStream.innerHTML = html || `<div class="cb-summary-muted">요약 내용이 없습니다.</div>`;
        elStream.scrollTop = elStream.scrollHeight;
    };

    const appendTextChunk = (chunk) => {
        const safe = escapeHTML(chunk);
        currentTextPlain += chunk;
        currentTextHTML += safe.replaceAll("\n", "<br/>");
        renderStreamHTML(`<p>${currentTextHTML}</p>`);
    };

    const stop = () => {
        running = false;
        if (timer) {
            window.clearInterval(timer);
            timer = null;
        }
        setLoading(false, "대화 요약 완료!");
    };

    const startFakeStream = ({ fileName, sessionId }) => {
        if (running) stop();

        running = true;
        currentTextPlain = "";
        currentTextHTML = "";
        renderStreamHTML(`<div class="cb-summary-muted">요약을 생성하고 있습니다…</div>`);
        setLoading(true, "요약 생성 중…");

        const sample = [
            `1) 데이터 구조 요약\n`,
            `- 총 12개 컬럼, 1,248건 레코드로 구성되어 있습니다.\n`,
            `- 주요 키 컬럼은 user_id / workdate / itemcode 조합으로 보입니다.\n\n`,
            `2) 값 분포/특이점\n`,
            `- 일부 컬럼은 NULL/빈 값이 혼재되어 있어 전처리가 필요합니다.\n`,
            `- 날짜(workdate)는 YYYYMMDD 형태이며, 범위 필터링이 가능해 보입니다.\n\n`,
            `3) 추천 처리 흐름\n`,
            `- 로딩 시 스키마 추론 → 결측치 정리 → 그룹핑/집계 → 화면 표출 순서를 권장합니다.\n\n`,
            `4) 다음 액션\n`,
            `- 사용자 화면에서는 “필터/정렬/검색” 기본 제공\n`,
            `- 서버에서는 페이징 + 그룹핑 API 분리 권장\n`
        ];

        let i = 0;
        let j = 0;

        timer = window.setInterval(() => {
            if (!running) return;

            const line = sample[i] || "";
            if (j >= line.length) {
                i += 1;
                j = 0;

                if (i >= sample.length) {
                    stop();
                } else {
                    appendTextChunk("\n");
                }
                return;
            }

            const step = Math.min(3, line.length - j);
            appendTextChunk(line.slice(j, j + step));
            j += step;
        }, 35);
    };

    const startRealStreamLater = async ({ fileName, sessionId }) => {
        void fileName;
        void sessionId;
        startFakeStream({ fileName, sessionId });

        /*
        const url = "/api/chat/csv/stream";
        const params = new URLSearchParams({ fileName, sessionId });
    
        setLoading(true, "요약 생성 중…");
        renderStreamHTML(`<div class="cb-summary-muted">요약을 생성하고 있습니다…</div>`);
    
        const res = await fetch(url + "?" + params.toString(), {
          method: "GET"
        });
    
        if (!res.ok || !res.body) {
          renderStreamHTML(`<div class="cb-summary-muted">요약 스트림을 불러오지 못했습니다.</div>`);
          setLoading(false, "실패");
          return;
        }
    
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
    
        currentTextPlain = "";
        currentTextHTML = "";
    
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
    
          const chunk = decoder.decode(value, { stream: true });
          appendTextChunk(chunk);
        }
    
        stop();
        */
    };

    const init = () => {
        const { fileName, sessionId } = parseQuery();

        const sub = [
            fileName ? `파일: ${fileName}` : "",
            sessionId ? `세션: ${sessionId}` : ""
        ].filter(Boolean).join(" · ");

        if (elSub) {
            elSub.textContent = sub || "대화방명 혹은 상대방명 · nynnnn";
        }

        if (btnRetry) {
            btnRetry.addEventListener("click", () => {
                startRealStreamLater({ fileName, sessionId });
            });
        }

        if (btnCopy) {
            btnCopy.addEventListener("click", async () => {
                const text = String(currentTextPlain || "").trim();
                if (!text) {
                    showToast("복사할 내용이 없습니다.");
                    return;
                }
                try {
                    await navigator.clipboard.writeText(text);
                    showToast("복사했습니다.");
                } catch {
                    showToast("복사에 실패했습니다.");
                }
            });
        }

        setLoading(true, "요약 생성 중…");
        startRealStreamLater({ fileName, sessionId });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
