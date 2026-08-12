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
        filterCategory: document.getElementById("pFilterCategory"),
        filterTag: document.getElementById("pFilterTag"),
        applyFilter: document.getElementById("pApplyFilter"),
        refresh: document.getElementById("pRefresh"),
        cards: document.getElementById("pCards"),
        cardsEmpty: document.getElementById("pCardsEmpty"),
        modal: document.getElementById("pModal"),
        modalBody: document.getElementById("pModalBody"),
        modalClose: document.getElementById("pModalClose"),
        confirm: document.getElementById("pConfirm"),
        confirmMsg: document.getElementById("pConfirmMsg"),
        confirmCancel: document.getElementById("pConfirmCancel"),
        confirmOk: document.getElementById("pConfirmOk"),
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
            // 보낸이: 내가 올린 파일(sender==접속 아이디)은 "나", 그 외엔 아이디
            var senderLabel = it.sender ? (String(it.sender) === ownerId ? "나" : esc(it.sender)) : "";
            var card = document.createElement("div");
            card.className = "p-card";
            card.innerHTML =
                '<div class="name">' + esc(nameOf(it)) + "</div>" +
                '<div class="sum">' + esc(summaryOf(it)) + "</div>" +
                renderTags(tagsOf(it)) +
                '<div class="meta">' +
                (senderLabel ? ("보낸이: " + senderLabel + "<br>") : "") +
                (when ? esc(when) : "") + "</div>" +
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
        var statusEl = addAiMsg();
        statusEl.textContent = "업로드·분석 중: " + file.name;

        var fd = new FormData();
        fd.append("sender", ownerId);
        fd.append("attachFile_bin", file);
        fd.append("attachFile_name", file.name || "");

        window.SseClient.stream(
            base + "/ingest",
            { method: "POST", headers: { Accept: "text/event-stream" }, body: fd, credentials: "same-origin" },
            {
                onProgress: function (msg, percent) {
                    statusEl.textContent = (typeof percent !== "undefined" ? percent + "% " : "") + (msg || "분석 중…");
                    scrollChat();
                },
                onEvent: function (type, obj) {
                    if (type === "enrichment") {
                        var d = obj.data || {};
                        statusEl.textContent = "분석 완료: " + (d.ai_summary ? String(d.ai_summary).slice(0, 60) : file.name);
                    }
                },
                onError: function (detail) { statusEl.textContent = "오류: " + detail; },
                onDone: function () {
                    statusEl.textContent = "인덱싱 완료: " + file.name;
                    if (dom.filesPanel.classList.contains("open")) loadFiles();
                },
            }
        ).catch(function (err) {
            statusEl.textContent = "실패: " + (err && err.message ? err.message : "");
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

    // 첫 진입 안내(시간·복사 포함 말풍선)
    addAiMsg().innerHTML =
        '안녕하세요! 업로드한 첨부파일을 AI가 분석·검색해 드립니다.<br>' +
        '· 하단 입력창에 자연어로 물어보세요. 예) "지난주 받은 계약서 요약해줘"<br>' +
        '· <b>＋</b> 버튼으로 첨부파일을 추가하거나 <b>내 파일</b> 목록을 볼 수 있어요.';
});
