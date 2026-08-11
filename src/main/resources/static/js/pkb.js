/**
 * PKB(AI 첨부파일 비서) 화면 (재구성 4.x, 명세서 8장).
 * 신규 API (dept는 서버가 ownerId로 해결):
 *   POST   /pkb/{ownerId}/ingest        AI 분석 인제스트 (SSE progress/enrichment)
 *   GET    /pkb/{ownerId}/files         내 파일 목록(category/tag 필터, JSON)
 *   GET    /pkb/{ownerId}/file/{hash}   파일 상세 (JSON)
 *   DELETE /pkb/{ownerId}/file/{hash}   파일 삭제 (JSON)
 *   POST   /pkb/{ownerId}/search        자연어 검색 (SSE, intent별 응답)
 * SSE 파싱은 공통 SseClient 사용.
 */
document.addEventListener("DOMContentLoaded", function () {
    var ownerId = String(window.ownerId || "");
    var base = "/pkb/" + encodeURIComponent(ownerId);

    var dom = {
        searchInput: document.getElementById("pSearchInput"),
        searchBtn: document.getElementById("pSearchBtn"),
        searchResult: document.getElementById("pSearchResult"),
        ingestBtn: document.getElementById("pIngestBtn"),
        fileInput: document.getElementById("pFileInput"),
        ingestStatus: document.getElementById("pIngestStatus"),
        filterCategory: document.getElementById("pFilterCategory"),
        filterTag: document.getElementById("pFilterTag"),
        applyFilter: document.getElementById("pApplyFilter"),
        refresh: document.getElementById("pRefresh"),
        cards: document.getElementById("pCards"),
        cardsEmpty: document.getElementById("pCardsEmpty"),
        modal: document.getElementById("pModal"),
        modalBody: document.getElementById("pModalBody"),
        modalClose: document.getElementById("pModalClose"),
    };

    var busy = false;

    // AI 파티션(dept) 스위처: 허용 dept 2개 이상일 때만 노출. 선택은 세션에 저장되어 PKB 요청에 적용.
    (function initDeptSwitch() {
        var sel = document.getElementById("pDeptSwitch");
        if (!sel) return;
        fetch("/me/depts?user=" + encodeURIComponent(ownerId), { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var depts = (d && d.depts) || [];
                var labels = (d && d.labels) || {};
                if (depts.length <= 1) return;
                sel.innerHTML = "";
                depts.forEach(function (c) {
                    var o = document.createElement("option");
                    o.value = c; o.textContent = labels[c] || c;
                    if (c === d.current) o.selected = true;
                    sel.appendChild(o);
                });
                sel.hidden = false;
                sel.addEventListener("change", function () {
                    var fd = new FormData(); fd.append("dept", sel.value); fd.append("user", ownerId);
                    fetch("/me/depts", { method: "POST", body: fd, credentials: "same-origin" });
                });
            })
            .catch(function () {});
    })();

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    function md(s) { return window.marked ? window.marked.parse(String(s || "")) : esc(s); }
    function hashOf(o) { return (o && (o.fileHash || o.hash || o.file_hash || o.id)) || ""; }
    function tagsOf(o) { return (o && (o.ai_tags || o.tags)) || []; }
    function summaryOf(o) { return (o && (o.ai_summary || o.summary)) || ""; }
    function nameOf(o) { return (o && (o.source || o.fileName || o.filename || o.name)) || "(이름 없음)"; }

    function normalizeList(json) {
        if (Array.isArray(json)) return json;
        if (json && Array.isArray(json.data)) return json.data;
        if (json && Array.isArray(json.files)) return json.files;
        return [];
    }

    // ── 내 파일 목록 ──────────────────────────────────────────
    function renderTags(tags) {
        if (!tags || !tags.length) return "";
        return '<div class="p-tags">' + tags.slice(0, 6).map(function (t) {
            return '<span class="p-tag">' + esc(t) + "</span>";
        }).join("") + "</div>";
    }

    function renderCards(items) {
        dom.cards.innerHTML = "";
        if (!items.length) { dom.cardsEmpty.classList.remove("hidden"); return; }
        dom.cardsEmpty.classList.add("hidden");
        items.forEach(function (it) {
            var hash = hashOf(it);
            var card = document.createElement("div");
            card.className = "p-card";
            card.innerHTML =
                '<div class="name">' + esc(nameOf(it)) + "</div>" +
                '<div class="sum">' + esc(summaryOf(it)) + "</div>" +
                renderTags(tagsOf(it)) +
                '<div class="meta">' + (it.sender ? ("보낸이: " + esc(it.sender)) : "") +
                (it.received_at ? (" · " + esc(it.received_at)) : "") + "</div>" +
                '<div class="acts">' +
                '<button data-act="detail">상세</button>' +
                '<button data-act="delete">삭제</button>' +
                "</div>";
            card.querySelector('[data-act="detail"]').addEventListener("click", function () { showDetail(hash); });
            card.querySelector('[data-act="delete"]').addEventListener("click", function () { removeFile(hash, nameOf(it)); });
            dom.cards.appendChild(card);
        });
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
            .then(function (json) { renderCards(normalizeList(json)); })
            .catch(function () { renderCards([]); });
    }

    // ── 상세 / 삭제 ───────────────────────────────────────────
    function showDetail(hash) {
        if (!hash) return;
        fetch(base + "/file/" + encodeURIComponent(hash), { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var d = (json && json.data) ? json.data : json;
                var kw = (d.ai_keywords || d.keywords || []);
                dom.modalBody.innerHTML =
                    "<h3>" + esc(nameOf(d)) + "</h3>" +
                    '<div class="k">AI 요약</div><div class="v">' + md(summaryOf(d)) + "</div>" +
                    (d.ai_category ? ('<div class="k">카테고리</div><div class="v">' + esc(d.ai_category) + "</div>") : "") +
                    '<div class="k">태그</div><div class="v">' + (tagsOf(d).map(esc).join(", ") || "-") + "</div>" +
                    '<div class="k">키워드</div><div class="v">' + (kw.map(esc).join(", ") || "-") + "</div>" +
                    (d.sender ? ('<div class="k">보낸이</div><div class="v">' + esc(d.sender) + "</div>") : "") +
                    (d.received_at ? ('<div class="k">수신일</div><div class="v">' + esc(d.received_at) + "</div>") : "");
                dom.modal.classList.add("open");
            })
            .catch(function () {
                dom.modalBody.innerHTML = '<div class="v">상세 정보를 불러오지 못했습니다.</div>';
                dom.modal.classList.add("open");
            });
    }

    function removeFile(hash, name) {
        if (!hash) return;
        if (!window.confirm('"' + name + '" 파일을 삭제할까요?')) return;
        fetch(base + "/file/" + encodeURIComponent(hash), { method: "DELETE", credentials: "same-origin" })
            .then(function (r) { return r.json().catch(function () { return {}; }); })
            .then(function () { loadFiles(); })
            .catch(function () { loadFiles(); });
    }

    // ── 인제스트(AI 분석) ─────────────────────────────────────
    function ingest(file) {
        if (!file || busy) return;
        busy = true;
        dom.ingestStatus.textContent = "업로드·분석 중: " + file.name;

        var fd = new FormData();
        fd.append("sender", ownerId);                 // UI 업로드는 소유자 본인
        fd.append("attachFile_bin", file);
        fd.append("attachFile_name", file.name || "");

        window.SseClient.stream(
            base + "/ingest",
            { method: "POST", headers: { Accept: "text/event-stream" }, body: fd, credentials: "same-origin" },
            {
                onProgress: function (msg, percent) {
                    dom.ingestStatus.textContent = (typeof percent !== "undefined" ? percent + "% " : "") + (msg || "분석 중…");
                },
                onEvent: function (type, obj) {
                    if (type === "enrichment") {
                        var d = obj.data || {};
                        dom.ingestStatus.textContent = "분석 완료: " + (d.ai_summary ? String(d.ai_summary).slice(0, 60) : file.name);
                    }
                },
                onError: function (detail) { dom.ingestStatus.textContent = "오류: " + detail; },
                onDone: function () { dom.ingestStatus.textContent = "인덱싱 완료: " + file.name; loadFiles(); },
            }
        ).catch(function (err) {
            dom.ingestStatus.textContent = "실패: " + (err && err.message ? err.message : "");
        }).finally(function () { busy = false; });
    }

    // ── 자연어 검색(intent별) ─────────────────────────────────
    function search() {
        var q = (dom.searchInput.value || "").trim();
        if (!q || busy) return;
        busy = true;
        dom.searchBtn.disabled = true;
        dom.searchResult.innerHTML = '<div class="p-analysis">검색 중…</div>';

        var analysisEl = null, answerEl = null, extraEl = null;
        var answer = "", refs = [];

        function ensureAnalysis() {
            if (!analysisEl) { analysisEl = document.createElement("div"); analysisEl.className = "p-analysis";
                dom.searchResult.innerHTML = ""; dom.searchResult.appendChild(analysisEl); }
            return analysisEl;
        }
        function ensureAnswer() {
            if (!answerEl) { answerEl = document.createElement("div"); answerEl.className = "p-answer";
                dom.searchResult.appendChild(answerEl); }
            return answerEl;
        }
        function ensureExtra() {
            if (!extraEl) { extraEl = document.createElement("div"); dom.searchResult.appendChild(extraEl); }
            return extraEl;
        }
        function renderAnswer() {
            ensureAnswer();
            var html = md(answer);
            if (refs.length) {
                html += '<div class="p-refs">참조: ' + refs.map(function (d) {
                    return esc(nameOf(d)) + (d.page != null ? (" p." + esc(d.page)) : "");
                }).join(", ") + "</div>";
            }
            answerEl.innerHTML = html;
        }

        var fd = new FormData();
        fd.append("message", q);

        window.SseClient.stream(
            base + "/search",
            { method: "POST", headers: { Accept: "text/event-stream" }, body: fd, credentials: "same-origin" },
            {
                onEvent: function (type, obj) {
                    var d = obj.data || obj;
                    if (type === "analysis") {
                        ensureAnalysis().textContent =
                            "의도: " + (d.intent || "-") + (d.search_query ? (" · 질의: " + d.search_query) : "");
                    } else if (type === "files") {
                        // file_lookup: 매칭된 파일 목록
                        var files = Array.isArray(d) ? d : normalizeList(obj);
                        ensureExtra().innerHTML = '<div class="p-title" style="margin-top:12px">매칭된 파일</div>' +
                            (files.length ? files.map(function (f) {
                                return '<div class="p-card" style="margin-top:8px"><div class="name">' + esc(nameOf(f)) +
                                    '</div><div class="sum">' + esc(summaryOf(f)) + "</div>" + renderTags(tagsOf(f)) + "</div>";
                            }).join("") : '<div class="p-empty">매칭된 파일이 없습니다.</div>');
                    } else if (type === "summaries") {
                        // summary_request: 파일별 요약
                        var sums = Array.isArray(d) ? d : normalizeList(obj);
                        ensureExtra().innerHTML = '<div class="p-title" style="margin-top:12px">요약</div>' +
                            sums.map(function (s) {
                                return '<div class="p-card" style="margin-top:8px"><div class="name">' + esc(nameOf(s)) +
                                    '</div><div class="v">' + md(summaryOf(s)) + "</div></div>";
                            }).join("");
                    }
                },
                onReferences: function (docs) { refs = docs || []; renderAnswer(); },
                onAnswer: function (text) { answer += text; renderAnswer(); },   // content_search
                onError: function (detail) { ensureAnalysis().textContent = "오류: " + detail; },
                onDone: function () { },
            }
        ).catch(function (err) {
            dom.searchResult.innerHTML = '<div class="p-analysis">검색 실패: ' +
                esc(err && err.message ? err.message : "") + "</div>";
        }).finally(function () {
            busy = false;
            dom.searchBtn.disabled = false;
        });
    }

    // ── 이벤트 바인딩 ─────────────────────────────────────────
    dom.ingestBtn.addEventListener("click", function () { dom.fileInput.click(); });
    dom.fileInput.addEventListener("change", function () {
        if (dom.fileInput.files && dom.fileInput.files[0]) ingest(dom.fileInput.files[0]);
        dom.fileInput.value = "";
    });
    dom.applyFilter.addEventListener("click", loadFiles);
    dom.refresh.addEventListener("click", loadFiles);
    dom.searchBtn.addEventListener("click", search);
    dom.searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); search(); }
    });
    dom.modalClose.addEventListener("click", function () { dom.modal.classList.remove("open"); });
    dom.modal.addEventListener("click", function (e) { if (e.target === dom.modal) dom.modal.classList.remove("open"); });

    loadFiles();
});
