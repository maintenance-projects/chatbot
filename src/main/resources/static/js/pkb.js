/**
 * PKB(AI 첨부파일 검색) 화면. 챗봇형 UI: 하단 검색입력 + 대화방 응답, 내 파일은 버튼으로 패널 오픈.
 *   POST   /pkb/{ownerId}/ingest        AI 분석 인제스트 (SSE progress/enrichment)
 *   GET    /pkb/{ownerId}/files         내 파일 목록(category/tag 필터, JSON)
 *   GET    /pkb/{ownerId}/file/{hash}   파일 상세 (JSON)
 *   DELETE /pkb/{ownerId}/file/{hash}   파일 삭제 (JSON)
 *   POST   /pkb/{ownerId}/search        자연어 검색 (SSE, intent별 응답)
 */
document.addEventListener("DOMContentLoaded", function () {
    var ownerId = String(window.ownerId || "");
    var base = "/pkb/" + encodeURIComponent(ownerId);

    var dom = {
        chat: document.getElementById("pChat"),
        searchInput: document.getElementById("pSearchInput"),
        searchBtn: document.getElementById("pSearchBtn"),
        plusBtn: document.getElementById("pPlusBtn"),
        menu: document.getElementById("pMenu"),
        ingestBtn: document.getElementById("pIngestBtn"),
        fileInput: document.getElementById("pFileInput"),
        filesBtn: document.getElementById("pFilesBtn"),
        filesPanel: document.getElementById("pFilesPanel"),
        filesClose: document.getElementById("pFilesClose"),
        filesNote: document.getElementById("pFilesNote"),
        filterCategory: document.getElementById("pFilterCategory"),
        filterTag: document.getElementById("pFilterTag"),
        applyFilter: document.getElementById("pApplyFilter"),
        refresh: document.getElementById("pRefresh"),
        cards: document.getElementById("pCards"),
        cardsEmpty: document.getElementById("pCardsEmpty"),
        moreBtn: document.getElementById("pMoreBtn"),
        modal: document.getElementById("pModal"),
        modalBody: document.getElementById("pModalBody"),
        modalClose: document.getElementById("pModalClose"),
        confirm: document.getElementById("pConfirm"),
        confirmMsg: document.getElementById("pConfirmMsg"),
        confirmCancel: document.getElementById("pConfirmCancel"),
        confirmOk: document.getElementById("pConfirmOk"),
        // 헤더 도구(안내/인쇄/검색) + 검색바 + 안내 모달
        pkbGuideBtn: document.getElementById("pkbGuideBtn"),
        pkbPrintBtn: document.getElementById("pkbPrintBtn"),
        pkbSearchBtn: document.getElementById("pkbSearchBtn"),
        searchBar: document.getElementById("pSearchBar"),
        searchbarInput: document.getElementById("pSearchbarInput"),
        searchMeta: document.getElementById("pSearchMeta"),
        searchPrev: document.getElementById("pSearchPrev"),
        searchNext: document.getElementById("pSearchNext"),
        searchbarClose: document.getElementById("pSearchbarClose"),
        guide: document.getElementById("pGuide"),
        guideClose: document.getElementById("pGuideClose"),
    };

    // PKB 마크업이 없는 화면(menuPkb=false 등)에서는 초기화하지 않음
    if (!dom.chat || !ownerId) return;

    var busy = false;
    var ttlDays = null; // 첨부파일 보관일수(PKB_DOC_TTL)
    var allFiles = [], shownCount = 0;   // 내 파일: 전체(최신순) + 표시 개수(더보기)
    var PAGE_SIZE = 20;

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    function md(s) { return window.marked ? window.marked.parse(String(s || "")) : esc(s); }
    function hashOf(o) { return (o && (o.fileHash || o.hash || o.file_hash || o.id)) || ""; }
    function tagsOf(o) { return (o && (o.ai_tags || o.tags)) || []; }
    function summaryOf(o) { return (o && (o.ai_summary || o.summary)) || ""; }
    function nameOf(o) { return (o && (o.file_name || o.source || o.fileName || o.filename || o.name)) || "(이름 없음)"; }
    function timeOf(o) {
        if (!o) return "";
        return o.received_at || o.created_at || o.ingested_at || o.timestamp || o.reg_date || o.registDate || "";
    }

    // long/epoch 또는 날짜문자열 → "YYYY-MM-DD HH:mm:ss"
    function fmtTime(v) {
        if (v == null || v === "") return "";
        var d;
        if (typeof v === "number" || /^\d+$/.test(String(v))) {
            var n = Number(v);
            if (String(Math.trunc(n)).length <= 10) n *= 1000; // 초 단위면 ms로
            d = new Date(n);
        } else {
            d = new Date(v);
        }
        if (isNaN(d.getTime())) return String(v);
        var p = function (x) { return String(x).padStart(2, "0"); };
        return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " +
            p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    }

    // 시각값(epoch 초/ms 또는 날짜문자열) → 초 단위
    function toEpochSec(v) {
        if (v == null || v === "") return null;
        if (typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v))) {
            var n = Number(v);
            if (String(Math.trunc(n)).length > 10) n = n / 1000; // ms→초
            return n;
        }
        var d = new Date(v);
        return isNaN(d.getTime()) ? null : d.getTime() / 1000;
    }
    // 남은 보관 일수(보관일수 TTL - 경과). ttlDays/시각 없으면 null
    function remainDays(o) {
        if (ttlDays == null) return null;
        var sec = toEpochSec(timeOf(o));
        if (sec == null) return null;
        return Math.ceil((sec + ttlDays * 86400 - Date.now() / 1000) / 86400);
    }
    function updateTtlNote() {
        if (dom.filesNote && ttlDays != null) {
            dom.filesNote.textContent = "첨부파일은 업로드 후 " + ttlDays + "일간 보관되며, 이후 자동 삭제됩니다.";
            dom.filesNote.hidden = false;
        }
    }
    function fetchTtl() {
        fetch(base + "/ttl", { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (j && j.PKB_DOC_TTL != null) {
                    ttlDays = Number(j.PKB_DOC_TTL);
                    updateTtlNote();
                    if (dom.filesPanel.classList.contains("open")) loadFiles();
                }
            })
            .catch(function () {});
    }

    function normalizeList(json) {
        if (Array.isArray(json)) return json;
        if (json && Array.isArray(json.data)) return json.data;
        if (json && Array.isArray(json.files)) return json.files;
        return [];
    }
    function renderTags(tags) {
        if (!tags || !tags.length) return "";
        return '<div class="p-tags">' + tags.slice(0, 6).map(function (t) {
            return '<span class="p-tag">' + esc(t) + "</span>";
        }).join("") + "</div>";
    }

    // ── 대화방 ────────────────────────────────────────────────
    function pad2(n) { return String(n).padStart(2, "0"); }
    function fmtNow() { // 챗봇과 동일: "오전/오후 h:mm"
        var d = new Date(), h = d.getHours();
        var hh = (h % 12 === 0) ? 12 : (h % 12);
        return (h < 12 ? "오전" : "오후") + " " + hh + ":" + pad2(d.getMinutes());
    }
    function fallbackCopy(t) {
        try {
            var ta = document.createElement("textarea");
            ta.value = t; ta.setAttribute("readonly", "");
            ta.style.position = "fixed"; ta.style.left = "-9999px";
            document.body.appendChild(ta); ta.select();
            var ok = document.execCommand("copy"); ta.remove();
            return !!ok;
        } catch (e) { return false; }
    }
    function copyText(t) { // 복사 성공여부 Promise<boolean>
        t = String(t == null ? "" : t);
        if (!t.trim()) return Promise.resolve(false);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(t).then(function () { return true; })
                .catch(function () { return fallbackCopy(t); });
        }
        return Promise.resolve(fallbackCopy(t));
    }
    function makeCopyBar() {
        var bar = document.createElement("div");
        bar.className = "p-copybar";
        var btn = document.createElement("button");
        btn.className = "p-copybtn"; btn.type = "button";
        btn.setAttribute("aria-label", "복사"); btn.setAttribute("data-tooltip", "복사");
        btn.innerHTML = '<img src="/img/ic-copy.png" alt="복사" />';
        btn.addEventListener("click", function () {
            var msg = bar.parentElement;
            var textEl = msg && msg.querySelector(".p-msg__text");
            copyText(textEl ? (textEl.innerText || textEl.textContent || "") : "").then(function (ok) {
                btn.classList.toggle("is-done", !!ok);
                setTimeout(function () { btn.classList.remove("is-done"); }, 900);
            });
        });
        bar.appendChild(btn);
        return bar;
    }
    // 말풍선 생성 → 내용 요소(.p-msg__text) 반환. 시간·복사버튼 포함(챗봇과 동일)
    function makeMsg(variant) {
        var msg = document.createElement("div");
        msg.className = "p-msg " + variant;
        var text = document.createElement("div");
        text.className = "p-msg__text";
        msg.appendChild(text);
        var meta = document.createElement("div");
        meta.className = "p-meta";
        meta.textContent = fmtNow();
        msg.appendChild(meta);
        msg.appendChild(makeCopyBar());
        dom.chat.appendChild(msg);
        scrollChat();
        return text;
    }
    function addUserMsg(text) { makeMsg("p-msg--user").textContent = text; }
    function addAiMsg() { return makeMsg("p-msg--ai"); }
    function scrollChat() { dom.chat.scrollTop = dom.chat.scrollHeight; }

    // ── 자연어 검색(intent별) ─────────────────────────────────
    function fileMini(f) {
        return '<div class="p-card" style="margin-top:8px"><div class="name">' + esc(nameOf(f)) +
            '</div><div class="sum">' + esc(summaryOf(f)) + "</div>" + renderTags(tagsOf(f)) + "</div>";
    }
    function sumMini(s) {
        return '<div class="p-card" style="margin-top:8px"><div class="name">' + esc(nameOf(s)) +
            '</div><div class="v">' + md(summaryOf(s)) + "</div></div>";
    }

    function search() {
        var q = (dom.searchInput.value || "").trim();
        if (!q || busy) return;
        busy = true;
        dom.searchBtn.disabled = true;
        addUserMsg(q);
        dom.searchInput.value = "";

        var bubble = addAiMsg();
        var state = { analysis: "", answer: "", refs: [], extraHtml: "" };
        var done = false; // onDone은 여러 번 올 수 있어 1회만 처리
        function render() {
            var html = "";
            if (state.analysis) html += '<div class="p-analysis">' + esc(state.analysis) + "</div>";
            if (state.answer) html += md(state.answer);
            if (state.refs.length) {
                // 같은 파일의 여러 청크가 참조로 오므로 파일 단위로 중복 제거(페이지는 모아 표시)
                var byName = {}, order = [];
                state.refs.forEach(function (d) {
                    var nm = nameOf(d);
                    if (!byName[nm]) { byName[nm] = []; order.push(nm); }
                    if (d.page != null && byName[nm].indexOf(d.page) < 0) byName[nm].push(d.page);
                });
                var refStr = order.map(function (nm) {
                    var pages = byName[nm];
                    return esc(nm) + (pages.length ? (" p." + pages.map(esc).join(",")) : "");
                }).join(", ");
                html += '<div class="p-refs">참조: ' + refStr + "</div>";
            }
            if (state.extraHtml) html += state.extraHtml;
            bubble.innerHTML = html || '<div class="p-analysis">검색 중…</div>';
            scrollChat();
        }
        render();

        var fd = new FormData();
        fd.append("message", q);

        window.SseClient.stream(
            base + "/search",
            { method: "POST", headers: { Accept: "text/event-stream" }, body: fd, credentials: "same-origin" },
            {
                onEvent: function (type, obj) {
                    var d = obj.data || obj;
                    if (type === "analysis") {
                        state.analysis = "의도: " + (d.intent || "-") + (d.search_query ? (" · 질의: " + d.search_query) : "");
                        render();
                    } else if (type === "files") {
                        var files = Array.isArray(d) ? d : normalizeList(obj);
                        state.extraHtml = '<div class="p-sub-title">매칭된 파일</div>' +
                            (files.length ? files.map(fileMini).join("") : '<div class="p-empty">매칭된 파일이 없습니다.</div>');
                        render();
                    } else if (type === "summaries") {
                        var sums = Array.isArray(d) ? d : normalizeList(obj);
                        state.extraHtml = '<div class="p-sub-title">요약</div>' + sums.map(sumMini).join("");
                        render();
                    }
                },
                onReferences: function (docs) { state.refs = docs || []; render(); },
                onAnswer: function (text) { state.answer += text; render(); },
                onError: function (detail) { state.analysis = "오류: " + detail; render(); },
                onDone: function () { if (done) return; done = true; render(); },
            }
        ).catch(function (err) {
            state.analysis = "검색 실패: " + (err && err.message ? err.message : "");
            render();
        }).finally(function () {
            busy = false;
            dom.searchBtn.disabled = false;
        });
    }

    // ── 내 파일 목록(패널) ────────────────────────────────────
    function sortByNewest(list) {
        return list.slice().sort(function (a, b) {
            var ta = toEpochSec(timeOf(a)), tb = toEpochSec(timeOf(b));
            return (tb == null ? 0 : tb) - (ta == null ? 0 : ta);
        });
    }

    function renderCards() {
        dom.cards.innerHTML = "";
        if (!allFiles.length) {
            dom.cardsEmpty.classList.remove("hidden");
            if (dom.moreBtn) dom.moreBtn.hidden = true;
            return;
        }
        dom.cardsEmpty.classList.add("hidden");
        var items = allFiles.slice(0, shownCount);
        items.forEach(function (it) {
            var hash = hashOf(it);
            var when = fmtTime(timeOf(it));
            // 보낸이: 내가 올린 파일(sender==접속 아이디)은 "나", 그 외엔 아이디
            var senderLabel = it.sender ? (String(it.sender) === ownerId ? "나" : esc(it.sender)) : "";
            // 남은 보관 일수
            var rem = remainDays(it), remHtml = "";
            if (rem != null) {
                if (rem <= 0) remHtml = '<span class="p-remain expired">보관 만료(삭제 예정)</span>';
                else remHtml = '<span class="p-remain' + (rem <= 3 ? " soon" : "") + '">' + rem + "일 남음</span>";
            }
            var card = document.createElement("div");
            card.className = "p-card";
            card.innerHTML =
                '<div class="name">' + esc(nameOf(it)) + "</div>" +
                '<div class="sum">' + esc(summaryOf(it)) + "</div>" +
                renderTags(tagsOf(it)) +
                '<div class="meta">' +
                (senderLabel ? ("보낸이: " + senderLabel + "<br>") : "") +
                (when ? esc(when) : "") + "</div>" +
                remHtml +
                '<div class="acts">' +
                '<button data-act="detail">상세</button>' +
                '<button data-act="delete">삭제</button>' +
                "</div>";
            card.querySelector('[data-act="detail"]').addEventListener("click", function () { showDetail(hash); });
            card.querySelector('[data-act="delete"]').addEventListener("click", function () { removeFile(hash, nameOf(it)); });
            dom.cards.appendChild(card);
        });
        if (dom.moreBtn) {
            var remaining = allFiles.length - shownCount;
            dom.moreBtn.hidden = remaining <= 0;
            if (remaining > 0) dom.moreBtn.textContent = "더 보기 (" + remaining + ")";
        }
    }

    function loadFiles() {
        var qs = [];
        var cat = (dom.filterCategory.value || "").trim();
        var tag = (dom.filterTag.value || "").trim();
        if (cat) qs.push("category=" + encodeURIComponent(cat));
        if (tag) qs.push("tag=" + encodeURIComponent(tag));
        var url = base + "/files" + (qs.length ? "?" + qs.join("&") : "");
        return fetch(url, { credentials: "same-origin" })
            .then(function (r) { return r.json().catch(function () { return []; }); })
            .then(function (json) {
                allFiles = sortByNewest(normalizeList(json)); // 최신순
                shownCount = PAGE_SIZE;
                renderCards();
            })
            .catch(function () { allFiles = []; shownCount = 0; renderCards(); });
    }

    function openFiles() {
        dom.filesPanel.classList.add("open");
        dom.filesPanel.setAttribute("aria-hidden", "false");
        loadFiles();
    }
    function closeFiles() {
        dom.filesPanel.classList.remove("open");
        dom.filesPanel.setAttribute("aria-hidden", "true");
    }

    // ── 상세 / 삭제 ───────────────────────────────────────────
    function showDetail(hash) {
        if (!hash) return;
        fetch(base + "/file/" + encodeURIComponent(hash), { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var d = (json && json.data) ? json.data : json;
                var kw = (d.ai_keywords || d.keywords || []);
                var when = fmtTime(timeOf(d));
                var senderLabel = d.sender ? (String(d.sender) === ownerId ? "나" : esc(d.sender)) : "";
                dom.modalBody.innerHTML =
                    "<h3>" + esc(nameOf(d)) + "</h3>" +
                    '<div class="k">AI 요약</div><div class="v">' + md(summaryOf(d)) + "</div>" +
                    (d.ai_category ? ('<div class="k">카테고리</div><div class="v">' + esc(d.ai_category) + "</div>") : "") +
                    '<div class="k">태그</div><div class="v">' + (tagsOf(d).map(esc).join(", ") || "-") + "</div>" +
                    '<div class="k">키워드</div><div class="v">' + (kw.map(esc).join(", ") || "-") + "</div>" +
                    (senderLabel ? ('<div class="k">보낸이</div><div class="v">' + senderLabel + "</div>") : "") +
                    (when ? ('<div class="k">수신일</div><div class="v">' + esc(when) + "</div>") : "");
                dom.modal.classList.add("open");
            })
            .catch(function () {
                dom.modalBody.innerHTML = '<div class="v">상세 정보를 불러오지 못했습니다.</div>';
                dom.modal.classList.add("open");
            });
    }

    var confirmCb = null;
    function openConfirm(message, onOk) {
        dom.confirmMsg.textContent = message;
        confirmCb = onOk;
        dom.confirm.classList.add("open");
    }
    function closeConfirm() {
        dom.confirm.classList.remove("open");
        confirmCb = null;
    }

    function removeFile(hash, name) {
        if (!hash) return;
        openConfirm('"' + name + '" 파일을 삭제할까요?\n삭제하면 되돌릴 수 없습니다.', function () {
            fetch(base + "/file/" + encodeURIComponent(hash), { method: "DELETE", credentials: "same-origin" })
                .then(function (r) { return r.json().catch(function () { return {}; }); })
                .then(function () { loadFiles(); })
                .catch(function () { loadFiles(); });
        });
    }

    // ── 인제스트(AI 분석) ─────────────────────────────────────
    function ingest(file) {
        if (!file || busy) return;
        busy = true;

        // 접속자(오른쪽) 말풍선에 파일명 + 진행바 (챗봇 업로드와 동일한 위치)
        var upEl = makeMsg("p-msg--user");
        upEl.innerHTML =
            '<div class="p-upname">📎 ' + esc(file.name) + '</div>' +
            '<div class="p-upbar"><div class="p-upfill" style="width:0%"></div></div>' +
            '<div class="p-uptext">0%</div>';
        var fill = upEl.querySelector(".p-upfill");
        var ptext = upEl.querySelector(".p-uptext");
        function setPct(p) {
            p = Math.max(0, Math.min(100, Number(p) || 0));
            if (fill) fill.style.width = p + "%";
            if (ptext) ptext.textContent = Math.round(p) + "%";
        }

        var lastSummary = "";
        var done = false; // onDone은 (done 이벤트 + 스트림 종료로) 여러 번 올 수 있어 1회만 처리

        var fd = new FormData();
        fd.append("sender", ownerId);
        fd.append("attachFile_bin", file);
        fd.append("attachFile_name", file.name || "");

        window.SseClient.stream(
            base + "/ingest",
            { method: "POST", headers: { Accept: "text/event-stream" }, body: fd, credentials: "same-origin" },
            {
                onProgress: function (msg, percent) {
                    if (typeof percent !== "undefined") setPct(percent);
                    else if (ptext && msg) ptext.textContent = msg;
                    scrollChat();
                },
                onEvent: function (type, obj) {
                    if (type === "enrichment") {
                        var d = obj.data || {};
                        lastSummary = d.ai_summary || "";
                    }
                },
                onError: function (detail) {
                    if (ptext) ptext.textContent = "오류";
                    addAiMsg().textContent = "분석 오류: " + detail;
                },
                onDone: function () {
                    if (done) return;
                    done = true;
                    setPct(100);
                    if (ptext) ptext.textContent = "완료";
                    // 완료 결과를 AI(왼쪽) 말풍선으로 덧붙임
                    var aiEl = addAiMsg();
                    aiEl.innerHTML = '<b>분석 완료</b> · ' + esc(file.name) +
                        (lastSummary ? ('<br>' + md(lastSummary)) : '');
                    if (dom.filesPanel.classList.contains("open")) loadFiles();
                },
            }
        ).catch(function (err) {
            if (ptext) ptext.textContent = "실패";
            addAiMsg().textContent = "업로드 실패: " + (err && err.message ? err.message : "");
        }).finally(function () { busy = false; });
    }

    // ── 이벤트 바인딩 ─────────────────────────────────────────
    function toggleMenu(open) {
        var willOpen = (open === undefined) ? !dom.menu.classList.contains("open") : open;
        dom.menu.classList.toggle("open", willOpen);
        dom.menu.setAttribute("aria-hidden", willOpen ? "false" : "true");
    }
    dom.plusBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(); });
    document.addEventListener("click", function (e) {
        if (dom.menu.classList.contains("open") && !dom.menu.contains(e.target) && e.target !== dom.plusBtn) toggleMenu(false);
    });
    dom.ingestBtn.addEventListener("click", function () { toggleMenu(false); dom.fileInput.click(); });
    dom.fileInput.addEventListener("change", function () {
        if (dom.fileInput.files && dom.fileInput.files[0]) ingest(dom.fileInput.files[0]);
        dom.fileInput.value = "";
    });
    dom.filesBtn.addEventListener("click", function () { toggleMenu(false); openFiles(); });
    dom.filesClose.addEventListener("click", closeFiles);
    if (dom.moreBtn) dom.moreBtn.addEventListener("click", function () { shownCount += PAGE_SIZE; renderCards(); });
    dom.applyFilter.addEventListener("click", loadFiles);
    dom.refresh.addEventListener("click", function () { // 필터 초기화 후 전체 재조회
        dom.filterCategory.value = "";
        dom.filterTag.value = "";
        loadFiles();
    });
    dom.searchBtn.addEventListener("click", search);
    dom.searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); search(); }
    });
    dom.modalClose.addEventListener("click", function () { dom.modal.classList.remove("open"); });
    dom.modal.addEventListener("click", function (e) { if (e.target === dom.modal) dom.modal.classList.remove("open"); });
    dom.confirmCancel.addEventListener("click", closeConfirm);
    dom.confirmOk.addEventListener("click", function () { var cb = confirmCb; closeConfirm(); if (cb) cb(); });
    dom.confirm.addEventListener("click", function (e) { if (e.target === dom.confirm) closeConfirm(); });

    // 드래그앤드롭: PKB 영역에 파일을 놓으면 인제스트(AI 분석). 챗봇으로 넘어가지 않게 격리
    var shell = dom.chat.closest(".p-shell");
    if (shell) {
        var dragDepth = 0;
        function setDrag(on) { shell.classList.toggle("p-dragover", !!on); }
        shell.addEventListener("dragenter", function (e) { e.preventDefault(); e.stopPropagation(); dragDepth++; setDrag(true); });
        shell.addEventListener("dragover", function (e) { e.preventDefault(); e.stopPropagation(); setDrag(true); });
        shell.addEventListener("dragleave", function (e) { e.preventDefault(); e.stopPropagation(); dragDepth = Math.max(0, dragDepth - 1); if (dragDepth === 0) setDrag(false); });
        shell.addEventListener("drop", function (e) {
            e.preventDefault(); e.stopPropagation();
            dragDepth = 0; setDrag(false);
            var files = (e.dataTransfer && e.dataTransfer.files) ? Array.prototype.slice.call(e.dataTransfer.files) : [];
            if (files.length) ingest(files[0]);
        });
    }

    // ── 헤더 도구: 이용안내 / 인쇄 / 대화검색 (PKB 영역 대상) ──
    // 이용 안내
    if (dom.pkbGuideBtn && dom.guide) {
        dom.pkbGuideBtn.addEventListener("click", function () { dom.guide.classList.toggle("open"); });
        dom.guideClose.addEventListener("click", function () { dom.guide.classList.remove("open"); });
    }

    // 인쇄 — PKB 대화창(p-chat) 내용을 새 창에 담아 인쇄
    function pkbPrint() {
        pkbClearSearch();
        var html = dom.chat.innerHTML;
        var w = window.open("", "_blank", "width=900,height=700");
        if (!w) return;
        var css = 'body{font-family:PretendardVariable,"Malgun Gothic",sans-serif;margin:24px;background:#fff;color:#111;}' +
            '.wrap{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:8px;}' +
            '.p-divider{text-align:center;color:#666;font-size:12px;margin:6px 0;}' +
            '.p-msg{max-width:82%;border:1px solid #ddd;border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.5;word-break:break-word;}' +
            '.p-msg--user{align-self:flex-end;background:#6d28d9;color:#fff;}' +
            '.p-msg--ai{align-self:flex-start;background:#f1f5f9;}' +
            '.p-meta{margin-top:6px;font-size:11px;opacity:.7;}' +
            '.p-copybar{display:none!important;}.p-mark{background:#fde68a;}';
        w.document.open();
        w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"/><title>첨부파일 검색 대화 인쇄</title><style>' +
            css + '</style></head><body><div class="wrap">' + html + '</div><scr' + 'ipt>window.onload=function(){window.focus();window.print();};</scr' + 'ipt></body></html>');
        w.document.close();
    }
    if (dom.pkbPrintBtn) dom.pkbPrintBtn.addEventListener("click", pkbPrint);

    // 대화 내용 검색(하이라이트 + 이전/다음)
    var pkbHits = [], pkbHitIdx = -1;
    function pkbClearSearch() {
        dom.chat.querySelectorAll(".p-msg__text[data-orig]").forEach(function (el) {
            el.innerHTML = el.getAttribute("data-orig"); el.removeAttribute("data-orig");
        });
        dom.chat.querySelectorAll(".p-msg.p-hit").forEach(function (el) { el.classList.remove("p-hit"); });
        pkbHits = []; pkbHitIdx = -1;
    }
    function pkbHighlight(root, re) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(function (node) {
            var text = node.nodeValue; re.lastIndex = 0;
            if (!re.test(text)) return;
            re.lastIndex = 0;
            var frag = document.createDocumentFragment(), last = 0, m;
            while ((m = re.exec(text)) !== null) {
                if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
                var mk = document.createElement("mark"); mk.className = "p-mark"; mk.textContent = m[0];
                frag.appendChild(mk); last = m.index + m[0].length;
                if (m[0].length === 0) re.lastIndex++;
            }
            if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
            node.parentNode.replaceChild(frag, node);
        });
    }
    function pkbFocusHit(i) {
        if (!pkbHits.length) return;
        dom.chat.querySelectorAll(".p-msg.p-hit").forEach(function (el) { el.classList.remove("p-hit"); });
        var t = pkbHits[i]; t.classList.add("p-hit");
        var cr = dom.chat.getBoundingClientRect(), mr = t.getBoundingClientRect();
        dom.chat.scrollTo({ top: Math.max(0, dom.chat.scrollTop + (mr.top - cr.top) - 40), behavior: "smooth" });
        if (dom.searchMeta) dom.searchMeta.textContent = (i + 1) + " / " + pkbHits.length;
    }
    function pkbMoveHit(dir) {
        if (!pkbHits.length) return;
        pkbHitIdx = (pkbHitIdx + dir + pkbHits.length) % pkbHits.length;
        pkbFocusHit(pkbHitIdx);
    }
    function pkbDoSearch(kw) {
        pkbClearSearch();
        kw = (kw || "").trim();
        if (!kw) { if (dom.searchMeta) dom.searchMeta.textContent = "0 / 0"; return; }
        var re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        dom.chat.querySelectorAll(".p-msg__text").forEach(function (el) {
            re.lastIndex = 0;
            if (!re.test(el.textContent || "")) return;
            el.setAttribute("data-orig", el.innerHTML);
            re.lastIndex = 0; pkbHighlight(el, re);
            var msg = el.closest(".p-msg");
            if (msg) pkbHits.push(msg);
        });
        if (!pkbHits.length) { if (dom.searchMeta) dom.searchMeta.textContent = "0 / 0"; return; }
        pkbHitIdx = 0; pkbFocusHit(0);
    }
    function pkbToggleSearch(open) {
        if (!dom.searchBar) return;
        dom.searchBar.hidden = !open;
        if (open) { if (dom.searchbarInput) dom.searchbarInput.focus(); }
        else { if (dom.searchbarInput) dom.searchbarInput.value = ""; pkbClearSearch(); if (dom.searchMeta) dom.searchMeta.textContent = "0 / 0"; }
    }
    if (dom.pkbSearchBtn && dom.searchBar) {
        dom.pkbSearchBtn.addEventListener("click", function () { pkbToggleSearch(dom.searchBar.hidden); });
        dom.searchbarInput.addEventListener("input", function () { pkbDoSearch(dom.searchbarInput.value); });
        dom.searchbarInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); pkbMoveHit(e.shiftKey ? -1 : 1); }
            else if (e.key === "Escape") pkbToggleSearch(false);
        });
        dom.searchPrev.addEventListener("click", function () { pkbMoveHit(-1); });
        dom.searchNext.addEventListener("click", function () { pkbMoveHit(1); });
        dom.searchbarClose.addEventListener("click", function () { pkbToggleSearch(false); });
    }

    // 첫 진입 안내(시간·복사 포함 말풍선)
    addAiMsg().innerHTML =
        '안녕하세요! 업로드한 첨부파일을 AI가 분석·검색해 드립니다.<br>' +
        '· 하단 입력창에 자연어로 물어보세요. 예) "지난주 받은 계약서 요약해줘"<br>' +
        '· <b>＋</b> 버튼으로 첨부파일을 추가하거나 <b>내 파일</b> 목록을 볼 수 있어요.';

    // 첨부파일 보관일수(TTL) 조회 — 내 파일 안내/남은일수 표시용
    fetchTtl();
});
