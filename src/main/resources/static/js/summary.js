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
    let controller = null;

    const defaultFileName = "톡DB.csv";
    const defaultSessionId = "test";

    const state = {
        mode: "stream",
        stream: { plain: "", html: "" },
        parsed: null,
        lastRaw: "",
        ui: {
            dailyDayKeys: [],
            dailyGroups: new Map(),
            activeTab: "overall",
            activeDay: "",
        },
    };

    const escapeHTML = (s) =>
        String(s ?? "")
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
            sessionId: sessionId ? decodeURIComponent(sessionId) : "",
        };
    };

    const formatKoreanDate = (dateLike) => {
        const s = String(dateLike || "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{14}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        return s;
    };

    const parseYMD = (ymd) => {
        const s = String(ymd || "");
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        return { y: +m[1], mo: +m[2], d: +m[3] };
    };

    const getWeekdayKorean = (ymd) => {
        const p = parseYMD(ymd);
        if (!p) return "";
        const dt = new Date(p.y, p.mo - 1, p.d);
        const w = dt.getDay();
        return ["일", "월", "화", "수", "목", "금", "토"][w] || "";
    };

    const stripTopHeadingLine = (t) => String(t || "").replace(/^#{1,6}\s+.*?\n+/m, "");

    const mdToHtml = (md, { stripTopHeading = true } = {}) => {
        let raw = String(md ?? "");
        raw = raw.replace(/\r/g, "");
        if (stripTopHeading) raw = stripTopHeadingLine(raw);

        const lines = raw.split("\n");
        let html = "";
        let listMode = null;

        const closeList = () => {
            if (listMode === "ul") html += "</ul>";
            if (listMode === "ol") html += "</ol>";
            listMode = null;
        };

        const inline = (text) => {
            let s = escapeHTML(text);
            s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
            return s;
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? "";
            const trimmed = line.trim();

            if (!trimmed) {
                closeList();
                html += `<div class="cb-md-gap"></div>`;
                continue;
            }

            const hm = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (hm) {
                closeList();
                const level = Math.min(6, Math.max(1, hm[1].length));
                html += `<div class="cb-md-h${level}">${inline(hm[2] || "")}</div>`;
                continue;
            }

            const um = trimmed.match(/^[-*]\s+(.*)$/);
            if (um) {
                if (listMode !== "ul") {
                    closeList();
                    listMode = "ul";
                    html += "<ul>";
                }
                html += `<li>${inline(um[1] || "")}</li>`;
                continue;
            }

            const om = trimmed.match(/^(\d+)\.\s+(.*)$/);
            if (om) {
                if (listMode !== "ol") {
                    closeList();
                    listMode = "ol";
                    html += "<ol>";
                }
                html += `<li value="${escapeHTML(om[1])}">${inline(om[2] || "")}</li>`;
                continue;
            }

            closeList();
            html += `<div class="cb-md-p">${inline(trimmed)}</div>`;
        }

        closeList();

        html = html
            .replace(
                /(<div class="cb-md-gap"><\/div>){3,}/g,
                `<div class="cb-md-gap"></div><div class="cb-md-gap"></div>`
            )
            .trim();

        return html || `<div class="cb-summary-muted">요약 내용이 없습니다.</div>`;
    };

    const renderStreamHTML = (html) => {
        elStream.innerHTML = html || `<div class="cb-summary-muted">요약 내용이 없습니다.</div>`;
        elStream.scrollTop = elStream.scrollHeight;
    };

    const buildDailyGroups = (daily) => {
        const groups = new Map();
        for (const item of daily) {
            const day = formatKoreanDate(item?.date ?? "");
            if (!day) continue;
            if (!groups.has(day)) groups.set(day, []);
            groups.get(day).push(String(item?.summary ?? ""));
        }
        const keys = Array.from(groups.keys()).sort((a, b) => String(a).localeCompare(String(b)));
        return { groups, keys };
    };

    const renderDailyHeaderHTML = (dayKeys, activeDay) => {
        if (!dayKeys.length) return `<div class="cb-summary-muted">날짜별 요약이 없습니다.</div>`;
        const items = dayKeys
            .map((ymd) => {
                const p = parseYMD(ymd);
                const mo = p ? String(p.mo).padStart(2, "0") : "";
                const d = p ? String(p.d).padStart(2, "0") : "";
                const wd = getWeekdayKorean(ymd);
                const isActive = ymd === activeDay;
                return `
          <button type="button" class="cb-daypill ${isActive ? "is-active" : ""}" data-day="${escapeHTML(ymd)}">
            <div class="cb-daypill-md">${escapeHTML(mo)}/${escapeHTML(d)}</div>
            <div class="cb-daypill-wd">${escapeHTML(wd)}</div>
          </button>
        `;
            })
            .join("");
        return `<div class="cb-daybar" role="tablist" aria-label="날짜 선택">${items}</div>`;
    };

    const renderDailyBodyHTML = (groups, activeDay) => {
        if (!activeDay || !groups.has(activeDay)) return `<div class="cb-summary-muted">날짜를 선택해 주세요.</div>`;
        const summaries = groups.get(activeDay) || [];
        const body =
            summaries.length > 0
                ? summaries
                    .map((s, idx) => {
                        const block = mdToHtml(s, { stripTopHeading: true });
                        return `<div class="cb-md-block">${block}</div>${idx < summaries.length - 1 ? `<div class="cb-md-split"></div>` : ""}`;
                    })
                    .join("")
                : `<div class="cb-summary-muted">요약 내용이 없습니다.</div>`;
        return `
      <div class="cb-day-content">
        <div class="cb-day-content-title">${escapeHTML(activeDay)}</div>
        <div class="cb-day-content-body">${body}</div>
      </div>
    `;
    };

    const renderTabsHTML = (payload) => {
        const daily = Array.isArray(payload?.daily_summaries) ? payload.daily_summaries : [];
        const overall = String(payload?.overall_summary ?? "");

        const overallHTML = `<div class="cb-md">${mdToHtml(overall, { stripTopHeading: true })}</div>`;

        const { groups, keys } = buildDailyGroups(daily);

        state.ui.dailyGroups = groups;
        state.ui.dailyDayKeys = keys;
        state.ui.activeTab = "overall";
        state.ui.activeDay = keys[0] || "";

        const dailyHeader = renderDailyHeaderHTML(keys, state.ui.activeDay);
        const dailyBody = renderDailyBodyHTML(groups, state.ui.activeDay);

        renderStreamHTML(`
      <div class="cb-tab-wrap">
        <div class="cb-tabs" role="tablist" aria-label="요약 탭">
          <button type="button" class="cb-tab is-active" data-tab="overall" role="tab" aria-selected="true">전체</button> |
          <button type="button" class="cb-tab" data-tab="daily" role="tab" aria-selected="false">날짜별</button>
        </div>

        <div class="cb-tabpanels">
          <section class="cb-panel is-active" data-panel="overall" role="tabpanel">
            <div class="cb-panel-inner">${overallHTML}</div>
          </section>

          <section class="cb-panel" data-panel="daily" role="tabpanel">
            <div class="cb-panel-inner">
              <div class="cb-daily-wrap">
                ${dailyHeader}
                <div class="cb-daily-body">${dailyBody}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    `);

        const tabs = elStream.querySelectorAll(".cb-tab");
        const panels = elStream.querySelectorAll(".cb-panel");

        const activateTab = (name) => {
            state.ui.activeTab = name;
            tabs.forEach((t) => {
                const on = t.getAttribute("data-tab") === name;
                t.classList.toggle("is-active", on);
                t.setAttribute("aria-selected", on ? "true" : "false");
            });
            panels.forEach((p) => {
                const on = p.getAttribute("data-panel") === name;
                p.classList.toggle("is-active", on);
            });
            if (name === "daily") {
                const daybar = elStream.querySelector(".cb-daybar");
                if (daybar) daybar.scrollLeft = 0;
            }
        };

        tabs.forEach((t) => {
            t.addEventListener("click", () => activateTab(t.getAttribute("data-tab")));
        });

        const daybar = elStream.querySelector(".cb-daybar");
        if (daybar) {
            daybar.addEventListener("click", (e) => {
                const btn = e.target.closest(".cb-daypill");
                if (!btn) return;
                const ymd = btn.getAttribute("data-day") || "";
                if (!ymd) return;

                state.ui.activeDay = ymd;

                daybar.querySelectorAll(".cb-daypill").forEach((b) => {
                    b.classList.toggle("is-active", b === btn);
                });

                const bodyEl = elStream.querySelector(".cb-daily-body");
                if (bodyEl) bodyEl.innerHTML = renderDailyBodyHTML(state.ui.dailyGroups, state.ui.activeDay);

                try {
                    btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                } catch { }
            });
        }
    };

    const appendTextChunk = (chunk) => {
        if (!chunk) return;

        state.lastRaw += chunk;

        const safe = escapeHTML(chunk);
        state.stream.plain += chunk;
        state.stream.html += safe.replaceAll("\n", "<br/>");
        renderStreamHTML(`<p>${state.stream.html}</p>`);
    };

    const tryFinalizeRender = () => {
        const raw = String(state.lastRaw || "").trim();
        if (!raw) return;

        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start < 0 || end <= start) return;

        const maybe = raw.slice(start, end + 1);
        try {
            const json = JSON.parse(maybe);
            if (json && (json.daily_summaries || json.overall_summary)) {
                state.mode = "parsed";
                state.parsed = json;
                renderTabsHTML(json);
            }
        } catch { }
    };

    const stop = (finalMsg) => {
        running = false;
        if (controller) {
            try {
                controller.abort();
            } catch { }
            controller = null;
        }
        setLoading(false, finalMsg || "대화 요약 완료!");
    };

    const startStream = async ({ fileName, sessionId }) => {
        stop();

        if (!sessionId) {
            renderStreamHTML(`<div class="cb-summary-muted">아이디가 없음</div>`);
            setLoading(false, "실패");
            return;
        }

        running = true;
        state.mode = "stream";
        state.stream.plain = "";
        state.stream.html = "";
        state.parsed = null;
        state.lastRaw = "";
        state.ui.dailyDayKeys = [];
        state.ui.dailyGroups = new Map();
        state.ui.activeTab = "overall";
        state.ui.activeDay = "";

        setLoading(true, "요약 생성 중…");
        renderStreamHTML(`<div class="cb-summary-muted">요약을 생성하고 있습니다…</div>`);

        const url = "/api/chat/csv/stream";
        const params = new URLSearchParams();
        params.set("sessionId", sessionId);
        if (fileName) params.set("fileName", fileName);

        controller = new AbortController();

        let res;
        try {
            res = await fetch(url + "?" + params.toString(), {
                method: "GET",
                signal: controller.signal,
                headers: { Accept: "text/plain, text/event-stream, application/json" },
            });
        } catch {
            if (!running) return;
            renderStreamHTML(`<div class="cb-summary-muted">서버 연결에 실패했습니다.</div>`);
            setLoading(false, "실패");
            running = false;
            return;
        }

        if (!res.ok || !res.body) {
            renderStreamHTML(`<div class="cb-summary-muted">요약 스트림을 불러오지 못했습니다.</div>`);
            setLoading(false, "실패");
            running = false;
            return;
        }

        const ct = (res.headers.get("content-type") || "").toLowerCase();
        const isSSE = ct.includes("text/event-stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let sseBuffer = "";

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                if (!running) break;

                if (!isSSE) {
                    appendTextChunk(chunk);
                    continue;
                }

                sseBuffer += chunk;

                let idx;
                while ((idx = sseBuffer.indexOf("\n\n")) >= 0) {
                    const eventBlock = sseBuffer.slice(0, idx);
                    sseBuffer = sseBuffer.slice(idx + 2);

                    const lines = eventBlock.split("\n");
                    for (const line of lines) {
                        const trimmed = line.trimEnd();
                        if (!trimmed.startsWith("data:")) continue;

                        const data = trimmed.slice(5).trimStart();

                        if (data === "[DONE]") {
                            tryFinalizeRender();
                            stop("대화 요약 완료!");
                            try {
                                reader.cancel();
                            } catch { }
                            return;
                        }

                        appendTextChunk(data);
                    }
                }
            }

            if (running) {
                tryFinalizeRender();
                stop("대화 요약 완료!");
            }
        } catch {
            if (!running) return;
            renderStreamHTML(`<div class="cb-summary-muted">스트림 수신 중 오류가 발생했습니다.</div>`);
            setLoading(false, "실패");
            running = false;
        } finally {
            try {
                reader.releaseLock();
            } catch { }
        }
    };

    const init = () => {
        const q = parseQuery();
        const fileName = q.fileName || defaultFileName;
        const sessionId = q.sessionId || defaultSessionId;

        const sub = [fileName ? `파일: ${fileName}` : "", sessionId ? `ID: ${sessionId}` : ""]
            .filter(Boolean)
            .join(" · ");

        if (elSub) elSub.textContent = sub || "";

        if (btnRetry) {
            btnRetry.addEventListener("click", () => {
                startStream({ fileName, sessionId });
            });
        }

        if (btnCopy) {
            btnCopy.addEventListener("click", async () => {
                const text =
                    state.mode === "parsed"
                        ? JSON.stringify(state.parsed || {}, null, 2)
                        : String(state.stream.plain || "").trim();

                if (!text || !String(text).trim()) {
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
        startStream({ fileName, sessionId });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
