(() => {
    const $ = (id) => document.getElementById(id);

    const elStream = $("sumStream");
    const elSub = $("sumSub");
    const btnCopy = $("btnCopy");
    const btnRetry = $("btnRetry");
    const toast = $("sumToast");

    if (!elStream) return;

    let running = false;
    let controller = null;

    const state = {
        mode: "stream",
        stream: { plain: "", html: "" },
        parsed: null,
        lastRaw: "",
        ctx: { fileName: "", sessionId: "" },
        ui: {
            dailyDayKeys: [],
            dailyGroups: new Map(),
            activeTab: "overall",
            activeDay: "",
        },
        progress: {
            dateRange: { start: "", end: "" },
            lastMessage: "",
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

    const renderStreamHTML = (html) => {
        elStream.innerHTML = html || `<div class="cb-summary-muted">요약 내용이 없습니다.</div>`;
        elStream.scrollTop = elStream.scrollHeight;
    };

    const renderProgressHTML = (message) => {
        const msg = String(message || "").trim() || "처리 중";
        renderStreamHTML(`
      <div class="cb-progress-full">
        <div class="cb-progress-full-msg">${escapeHTML(msg)}</div>
        <div class="cb-progress-full-dots" aria-hidden="true">
          <span class="cb-progress-dot"></span>
          <span class="cb-progress-dot"></span>
          <span class="cb-progress-dot"></span>
        </div>
      </div>
    `);
    };

    const setLoading = (on, msg) => {
        const text = msg || (on ? "요약 생성 중" : "대화 요약 완료!");
        if (state.mode === "parsed") return;
        if (on) renderProgressHTML(text);
        else renderStreamHTML(`<div class="cb-summary-muted">${escapeHTML(text)}</div>`);
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

    const getContext = () => {
        const wFile = typeof window !== "undefined" ? String(window.fileName || "").trim() : "";
        const wSid = typeof window !== "undefined" ? String(window.sessionId || "").trim() : "";
        const q = parseQuery();
        return {
            fileName: wFile || q.fileName || "",
            sessionId: wSid || q.sessionId || "",
        };
    };

    const formatKoreanDate = (dateLike) => {
        const s = String(dateLike || "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{14}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        return s;
    };

    const updateSubByDateRange = (start, end) => {
        const s = formatKoreanDate(start);
        const e = formatKoreanDate(end);
        state.progress.dateRange.start = s;
        state.progress.dateRange.end = e;

        if (!elSub) return;
        if (s && e) {
            elSub.textContent = `요약 기간: ${s} ~ ${e}`;
            return;
        }
        if (s && !e) {
            elSub.textContent = `요약 기간: ${s}`;
            return;
        }
        elSub.textContent = "요약 기간: -";
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

    const stripTopHeadingLine = (t) => String(t || "").replace(/^\s*#{1,2}\s+.*?\n+/, "");

    const mdToHtml = (md, { stripTopHeading = true } = {}) => {
        let raw = String(md ?? "").replace(/\r/g, "");
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
                const hashes = hm[1] || "";
                const text = hm[2] || "";

                if (hashes.length >= 3) {
                    html += `<div class="cb-md-p">${inline(hashes + " " + text)}</div>`;
                } else {
                    const level = Math.min(6, Math.max(1, hashes.length));
                    html += `<div class="cb-md-h${level}">${inline(text)}</div>`;
                }
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

    const enableDragScrollX = (scroller) => {
        if (!scroller) return;

        let isDown = false;
        let startX = 0;
        let startScrollLeft = 0;
        let moved = false;

        const getX = (e) => {
            if (e.touches && e.touches[0]) return e.touches[0].clientX;
            return e.clientX;
        };

        const onDown = (e) => {
            if (e.button != null && e.button !== 0) return;
            isDown = true;
            moved = false;
            scroller.dataset.dragging = "0";
            startX = getX(e);
            startScrollLeft = scroller.scrollLeft;
            scroller.classList.add("is-dragging");
        };

        const onMove = (e) => {
            if (!isDown) return;
            const x = getX(e);
            const dx = x - startX;
            if (Math.abs(dx) > 3) moved = true;

            scroller.scrollLeft = startScrollLeft - dx;

            if (e.cancelable) e.preventDefault();
        };

        const onUp = () => {
            if (!isDown) return;
            isDown = false;
            scroller.classList.remove("is-dragging");

            if (moved) {
                scroller.dataset.dragging = "1";
                window.setTimeout(() => {
                    scroller.dataset.dragging = "0";
                }, 120);
            }
        };

        scroller.addEventListener("mousedown", onDown);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);

        scroller.addEventListener("touchstart", onDown, { passive: true });
        scroller.addEventListener("touchmove", onMove, { passive: false });
        scroller.addEventListener("touchend", onUp);
        scroller.addEventListener("touchcancel", onUp);
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
                        return `<div class="cb-md-block">${block}</div>${idx < summaries.length - 1 ? `<div class="cb-md-split"></div>` : ""
                            }`;
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
                const daybar2 = elStream.querySelector(".cb-daybar");
                if (daybar2) daybar2.scrollLeft = 0;
            }
        };

        tabs.forEach((t) => {
            t.addEventListener("click", () => activateTab(t.getAttribute("data-tab")));
        });

        const daybar = elStream.querySelector(".cb-daybar");
        if (daybar) {
            enableDragScrollX(daybar);

            daybar.addEventListener("click", (e) => {
                if (daybar.dataset.dragging === "1") return;

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

    const stop = (finalMsg, { abort = true, silent = false } = {}) => {
        running = false;

        if (abort && controller) {
            try {
                controller.abort();
            } catch { }
        }
        controller = null;

        if (!silent) setLoading(false, finalMsg || "대화 요약 완료!");
    };

    const resetStateForRun = () => {
        state.mode = "stream";
        state.stream.plain = "";
        state.stream.html = "";
        state.parsed = null;
        state.lastRaw = "";
        state.ui.dailyDayKeys = [];
        state.ui.dailyGroups = new Map();
        state.ui.activeTab = "overall";
        state.ui.activeDay = "";
        state.progress.lastMessage = "";
    };

    const normalizeContentPayload = (obj) => {
        if (!obj) return null;

        if (obj.overall_summary || obj.daily_summaries) return obj;

        const c = obj.content;
        if (typeof c === "object" && c) {
            if (c.overall_summary || c.daily_summaries) return c;
        }

        if (typeof c === "string") {
            const t = c.trim();
            if (t.startsWith("{") && t.endsWith("}")) {
                try {
                    const j = JSON.parse(t);
                    if (j && (j.overall_summary || j.daily_summaries)) return j;
                } catch { }
            }
            return { overall_summary: c, daily_summaries: [] };
        }

        return null;
    };

    const handleProgress = (obj) => {
        const step = String(obj?.step || "").trim();
        const msg = String(obj?.message || "").trim();

        const hasRange = obj && (obj.start_date || obj.end_date);
        if (hasRange) updateSubByDateRange(obj?.start_date, obj?.end_date);

        const showMsg = msg || (hasRange ? "기간 계산 중" : step ? `${step} 처리 중` : "처리 중");

        state.progress.lastMessage = showMsg;
        setLoading(true, showMsg);
    };

    const handleContent = (obj) => {
        const payload = normalizeContentPayload(obj);
        if (!payload) return;

        state.mode = "parsed";
        state.parsed = payload;
        renderTabsHTML(payload);
    };

    const handleDone = (obj) => {
        const msg = String(obj?.message || "").trim();
        stop(msg || "대화 요약 완료!", { abort: false });
        return "done";
    };

    const handleDataLine = (data) => {
        const text = String(data ?? "");
        const trimmed = text.trim();

        if (!trimmed) return;

        if (trimmed === "[DONE]") {
            stop("대화 요약 완료!", { abort: false });
            return "done";
        }

        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
                const obj = JSON.parse(trimmed);

                if (obj?.type === "progress") {
                    handleProgress(obj);
                    return;
                }

                if (obj?.type === "content") {
                    handleContent(obj);
                    return;
                }

                if (obj?.type === "result") {
                    handleContent(obj);
                    return;
                }

                if (obj?.type === "done") {
                    return handleDone(obj);
                }

                if (obj?.overall_summary || obj?.daily_summaries || obj?.content) {
                    handleContent(obj);
                    return;
                }
            } catch { }
        }

        if (state.mode === "parsed") return;

        appendTextChunk(text);
    };

    const startStream = async ({ fileName, sessionId }) => {
        stop(null, { abort: true, silent: true });
        resetStateForRun();
        state.ctx = { fileName: String(fileName || ""), sessionId: String(sessionId || "") };

        if (!state.ctx.sessionId) {
            renderStreamHTML(`<div class="cb-summary-muted">아이디가 없음</div>`);
            setLoading(false, "실패");
            return;
        }

        running = true;

        setLoading(true, "요약 생성 중");

        const url = "/api/chat/csv/stream";
        const params = new URLSearchParams();
        params.set("sessionId", state.ctx.sessionId);
        if (state.ctx.fileName) params.set("fileName", state.ctx.fileName);

        controller = new AbortController();

        let res;
        try {
            res = await fetch(url + "?" + params.toString(), {
                method: "GET",
                signal: controller.signal,
                headers: { Accept: "text/event-stream, application/json, text/plain" },
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

        const flushSSE = () => {
            let idx;
            while ((idx = sseBuffer.indexOf("\n\n")) >= 0) {
                const eventBlock = sseBuffer.slice(0, idx);
                sseBuffer = sseBuffer.slice(idx + 2);

                const lines = eventBlock.split("\n");
                const dataLines = [];
                for (const line of lines) {
                    const t = line.trimEnd();
                    if (!t.startsWith("data:")) continue;
                    dataLines.push(t.slice(5).trimStart());
                }
                if (!dataLines.length) continue;

                const data = dataLines.join("\n");
                const r = handleDataLine(data);
                if (r === "done") return true;
            }
            return false;
        };

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                if (!running) break;

                if (!isSSE) {
                    const r = handleDataLine(chunk);
                    if (r === "done") break;
                    continue;
                }

                sseBuffer += chunk;
                if (flushSSE()) {
                    try {
                        reader.cancel();
                    } catch { }
                    return;
                }
            }

            if (running) {
                if (isSSE && sseBuffer) flushSSE();
            }
        } catch (e) {
            if (!running) return;
            if (e && (e.name === "AbortError" || String(e).includes("AbortError"))) return;

            renderStreamHTML(`<div class="cb-summary-muted">스트림 수신 중 오류가 발생했습니다.</div>`);
            setLoading(false, "실패");
            running = false;
        } finally {
            try {
                reader.releaseLock();
            } catch { }
        }
    };

    const getCopyTextUI = () => {
        const pick = (sel) => elStream.querySelector(sel);

        if (state.mode === "parsed") {
            if (state.ui.activeTab === "overall") {
                const el = pick('[data-panel="overall"] .cb-panel-inner');
                return String(el?.innerText || "").trim();
            }

            if (state.ui.activeTab === "daily") {
                const title = String(pick(".cb-day-content-title")?.innerText || "").trim();
                const body = String(pick(".cb-day-content-body")?.innerText || "").trim();
                return [title, body].filter(Boolean).join("\n\n").trim();
            }

            const fallback = pick(".cb-panel.is-active .cb-panel-inner");
            return String(fallback?.innerText || "").trim();
        }

        return String(state.stream.plain || elStream.innerText || "").trim();
    };

    const init = () => {
        const ctx = getContext();
        state.ctx = ctx;

        if (elSub) elSub.textContent = "요약 기간: -";

        if (btnRetry) {
            btnRetry.addEventListener("click", () => {
                const next = getContext();
                state.ctx = next;
                startStream(next);
            });
        }

        if (btnCopy) {
            btnCopy.addEventListener("click", async () => {
                const text = getCopyTextUI();

                if (!text) {
                    showToast("복사할 내용이 없습니다.");
                    return;
                }

                try {
                    await navigator.clipboard.writeText(text);
                    showToast("복사했습니다.");
                } catch {
                    try {
                        const ta = document.createElement("textarea");
                        ta.value = text;
                        ta.setAttribute("readonly", "");
                        ta.style.position = "fixed";
                        ta.style.left = "-9999px";
                        ta.style.top = "0";
                        document.body.appendChild(ta);
                        ta.focus();
                        ta.select();
                        document.execCommand("copy");
                        document.body.removeChild(ta);
                        showToast("복사했습니다.");
                    } catch {
                        showToast("복사에 실패했습니다.");
                    }
                }
            });
        }

        startStream(ctx);
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
