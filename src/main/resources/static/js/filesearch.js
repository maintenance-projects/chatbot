/**
 * 첨부파일 검색 화면 (재구성 4.x, 명세서 7장).
 * 신규 API:
 *   POST /file-search/upload/{invokeId}  업로드·인덱싱 (SSE progress/done)
 *   POST /file-search/ask/{invokeId}     내용 질문 (SSE references/answer)
 *   GET  /file-search/files/{invokeId}   인덱싱 파일 목록 (JSON)
 * dept는 서버가 세션에서 주입. SSE 파싱은 공통 SseClient 사용.
 */
document.addEventListener("DOMContentLoaded", function () {
    var invokeId = String(window.invokeId || "");
    var base = "/file-search";
    var idPath = "/" + encodeURIComponent(invokeId);

    var dom = {
        files: document.getElementById("fsFiles"),
        body: document.getElementById("fsBody"),
        input: document.getElementById("fsInput"),
        send: document.getElementById("fsSend"),
        target: document.getElementById("fsTarget"),
        uploadBtn: document.getElementById("fsUploadBtn"),
        refreshBtn: document.getElementById("fsRefreshBtn"),
        fileInput: document.getElementById("fsFileInput"),
    };

    var targetFilename = null;
    var busy = false;

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function scrollBottom() { dom.body.scrollTop = dom.body.scrollHeight; }

    function addMsg(cls, text) {
        var el = document.createElement("div");
        el.className = "fs-msg " + cls;
        el.textContent = text || "";
        dom.body.appendChild(el);
        scrollBottom();
        return el;
    }

    function addProgress() {
        var el = document.createElement("div");
        el.className = "fs-progress";
        el.textContent = "처리 중…";
        dom.body.appendChild(el);
        scrollBottom();
        return el;
    }

    // ── 파일 목록 ─────────────────────────────────────────────
    function normalizeFiles(json) {
        var arr = [];
        if (Array.isArray(json)) arr = json;
        else if (json && Array.isArray(json.files)) arr = json.files;
        else if (json && Array.isArray(json.data)) arr = json.data;
        return arr.map(function (x) {
            if (typeof x === "string") return x;
            return (x && (x.source || x.fileName || x.filename || x.name)) || "";
        }).filter(Boolean);
    }

    function renderFiles(names) {
        dom.files.innerHTML = "";
        if (!names.length) {
            var empty = document.createElement("span");
            empty.className = "fs-chip empty";
            empty.textContent = "인덱싱된 파일이 없습니다.";
            dom.files.appendChild(empty);
            return;
        }
        names.forEach(function (name) {
            var chip = document.createElement("button");
            chip.type = "button";
            chip.className = "fs-chip" + (name === targetFilename ? " is-active" : "");
            chip.textContent = name;
            chip.addEventListener("click", function () { setTarget(name); });
            dom.files.appendChild(chip);
        });
    }

    function setTarget(name) {
        targetFilename = name;
        dom.target.textContent = name ? ("검색 대상: " + name) : "검색할 파일을 위에서 선택하세요.";
        var chips = dom.files.querySelectorAll(".fs-chip");
        for (var i = 0; i < chips.length; i++) {
            chips[i].classList.toggle("is-active", chips[i].textContent === name);
        }
    }

    function loadFiles() {
        return fetch(base + "/files" + idPath, { credentials: "same-origin" })
            .then(function (res) { return res.json().catch(function () { return []; }); })
            .then(function (json) { renderFiles(normalizeFiles(json)); })
            .catch(function () { renderFiles([]); });
    }

    // ── 업로드(인덱싱) ────────────────────────────────────────
    function upload(file) {
        if (!file || busy) return;
        busy = true;
        var prog = addProgress();
        prog.textContent = "업로드 중: " + file.name;

        var fd = new FormData();
        fd.append("attachFile_bin", file);
        fd.append("attachFile_name", file.name || "");

        window.SseClient.stream(
            base + "/upload" + idPath,
            { method: "POST", headers: { Accept: "text/event-stream" }, body: fd, credentials: "same-origin" },
            {
                onProgress: function (msg, percent) {
                    prog.textContent = (typeof percent !== "undefined" ? percent + "% " : "") + (msg || "인덱싱 중…");
                },
                onError: function (detail) { prog.textContent = "오류: " + detail; },
                onDone: function () {
                    prog.textContent = "인덱싱 완료: " + file.name;
                    loadFiles();
                },
            }
        ).catch(function (err) {
            prog.textContent = "업로드 실패: " + (err && err.message ? err.message : "");
        }).finally(function () { busy = false; });
    }

    // ── 질문 ─────────────────────────────────────────────────
    function ask() {
        var q = (dom.input.value || "").trim();
        if (!q || busy) return;
        if (!targetFilename) { setTarget(null); dom.target.textContent = "먼저 검색할 파일을 선택하세요."; return; }

        busy = true;
        dom.send.disabled = true;
        addMsg("user", q);
        dom.input.value = "";

        var prog = addProgress();
        var botEl = null;
        var answer = "";
        var refs = [];

        function ensureBot() {
            if (botEl) return botEl;
            if (prog && prog.parentNode) prog.parentNode.removeChild(prog);
            botEl = document.createElement("div");
            botEl.className = "fs-msg bot";
            dom.body.appendChild(botEl);
            return botEl;
        }

        function render() {
            ensureBot();
            var html = (window.marked ? window.marked.parse(answer || "") : esc(answer));
            if (refs.length) {
                html += '<div class="fs-refs">참조: ' + refs.map(function (d) {
                    var src = esc(d.source || d.fileName || "문서");
                    var pg = (d.page != null) ? (" p." + esc(d.page)) : "";
                    return src + pg;
                }).join(", ") + "</div>";
            }
            botEl.innerHTML = html;
            scrollBottom();
        }

        var fd = new FormData();
        fd.append("message", q);
        fd.append("target_filename", targetFilename);

        window.SseClient.stream(
            base + "/ask" + idPath,
            { method: "POST", headers: { Accept: "text/event-stream" }, body: fd, credentials: "same-origin" },
            {
                onProgress: function (msg) { if (prog) prog.textContent = msg || "검색 중…"; },
                onReferences: function (docs) { refs = docs || []; render(); },
                onAnswer: function (text) { answer += text; render(); },
                onError: function (detail) { ensureBot(); botEl.textContent = "오류: " + detail; },
                onDone: function () {
                    if (!botEl) { ensureBot(); botEl.textContent = "답변이 없습니다."; }
                    if (prog && prog.parentNode) prog.parentNode.removeChild(prog);
                },
            }
        ).catch(function (err) {
            ensureBot();
            botEl.textContent = "요청 실패: " + (err && err.message ? err.message : "");
        }).finally(function () {
            busy = false;
            dom.send.disabled = false;
            dom.input.focus();
        });
    }

    // ── 이벤트 바인딩 ─────────────────────────────────────────
    dom.uploadBtn.addEventListener("click", function () { dom.fileInput.click(); });
    dom.fileInput.addEventListener("change", function () {
        if (dom.fileInput.files && dom.fileInput.files[0]) upload(dom.fileInput.files[0]);
        dom.fileInput.value = "";
    });
    dom.refreshBtn.addEventListener("click", loadFiles);
    dom.send.addEventListener("click", ask);
    dom.input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
    });

    loadFiles();
});
