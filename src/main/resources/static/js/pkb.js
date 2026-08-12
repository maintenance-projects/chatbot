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
        hello: document.getElementById("pHello"),
        searchInput: document.getElementById("pSearchInput"),
        searchBtn: document.getElementById("pSearchBtn"),
        ingestBtn: document.getElementById("pIngestBtn"),
        fileInput: document.getElementById("pFileInput"),
        ingestStatus: document.getElementById("pIngestStatus"),
        filesBtn: document.getElementById("pFilesBtn"),
        filesPanel: document.getElementById("pFilesPanel"),
        filesClose: document.getElementById("pFilesClose"),
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

    // PKB 마크업이 없는 화면(menuPkb=false 등)에서는 초기화하지 않음
    if (!dom.chat || !ownerId) return;

    var busy = false;

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
    function addUserMsg(text) {
        var el = document.createElement("div");
        el.className = "p-msg p-msg--user";
        el.textContent = text;
        dom.chat.appendChild(el);
        scrollChat();
    }
    function addAiMsg() {
        var el = document.createElement("div");
        el.className = "p-msg p-msg--ai";
        dom.chat.appendChild(el);
        scrollChat();
        return el;
    }
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
        if (dom.hello) dom.hello.style.display = "none";
        addUserMsg(q);
        dom.searchInput.value = "";

        var bubble = addAiMsg();
        var state = { analysis: "", answer: "", refs: [], extraHtml: "" };
        function render() {
            var html = "";
            if (state.analysis) html += '<div class="p-analysis">' + esc(state.analysis) + "</div>";
            if (state.answer) html += md(state.answer);
            if (state.refs.length) {
                html += '<div class="p-refs">참조: ' + state.refs.map(function (d) {
                    return esc(nameOf(d)) + (d.page != null ? (" p." + esc(d.page)) : "");
                }).join(", ") + "</div>";
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
                onDone: function () { render(); },
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
    function renderCards(items) {
        dom.cards.innerHTML = "";
        if (!items.length) { dom.cardsEmpty.classList.remove("hidden"); return; }
        dom.cardsEmpty.classList.add("hidden");
        items.forEach(function (it) {
            var hash = hashOf(it);
            var when = fmtTime(timeOf(it));
            var card = document.createElement("div");
            card.className = "p-card";
            card.innerHTML =
                '<div class="name">' + esc(nameOf(it)) + "</div>" +
                '<div class="sum">' + esc(summaryOf(it)) + "</div>" +
                renderTags(tagsOf(it)) +
                '<div class="meta">' + (it.sender ? ("보낸이: " + esc(it.sender)) : "") +
                (when ? ((it.sender ? " · " : "") + esc(when)) : "") + "</div>" +
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
                dom.modalBody.innerHTML =
                    "<h3>" + esc(nameOf(d)) + "</h3>" +
                    '<div class="k">AI 요약</div><div class="v">' + md(summaryOf(d)) + "</div>" +
                    (d.ai_category ? ('<div class="k">카테고리</div><div class="v">' + esc(d.ai_category) + "</div>") : "") +
                    '<div class="k">태그</div><div class="v">' + (tagsOf(d).map(esc).join(", ") || "-") + "</div>" +
                    '<div class="k">키워드</div><div class="v">' + (kw.map(esc).join(", ") || "-") + "</div>" +
                    (d.sender ? ('<div class="k">보낸이</div><div class="v">' + esc(d.sender) + "</div>") : "") +
                    (when ? ('<div class="k">수신일</div><div class="v">' + esc(when) + "</div>") : "");
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
        fd.append("sender", ownerId);
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
                onDone: function () {
                    dom.ingestStatus.textContent = "인덱싱 완료: " + file.name;
                    if (dom.filesPanel.classList.contains("open")) loadFiles();
                },
            }
        ).catch(function (err) {
            dom.ingestStatus.textContent = "실패: " + (err && err.message ? err.message : "");
        }).finally(function () { busy = false; });
    }

    // ── 이벤트 바인딩 ─────────────────────────────────────────
    dom.ingestBtn.addEventListener("click", function () { dom.fileInput.click(); });
    dom.fileInput.addEventListener("change", function () {
        if (dom.fileInput.files && dom.fileInput.files[0]) ingest(dom.fileInput.files[0]);
        dom.fileInput.value = "";
    });
    dom.filesBtn.addEventListener("click", openFiles);
    dom.filesClose.addEventListener("click", closeFiles);
    dom.applyFilter.addEventListener("click", loadFiles);
    dom.refresh.addEventListener("click", loadFiles);
    dom.searchBtn.addEventListener("click", search);
    dom.searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); search(); }
    });
    dom.modalClose.addEventListener("click", function () { dom.modal.classList.remove("open"); });
    dom.modal.addEventListener("click", function (e) { if (e.target === dom.modal) dom.modal.classList.remove("open"); });
});
