/**
 * 공통 SSE 클라이언트 (재구성 4.x)
 * 신규 AI 서버 계약(data: {"type": ...}\n\n)을 파싱해 타입별 콜백으로 디스패치한다.
 * 챗봇/파일검색/PKB 화면이 공유한다. 폐쇄망: 번들러/외부 의존 없음(순수 브라우저 전역).
 *
 * handlers 콜백(모두 선택):
 *   onProgress(message, percent)      진행률
 *   onReferences(docs)                참조 문서 배열
 *   onAnswer(text)                    LLM 답변 토큰(스트리밍)
 *   onTranslation(text, lang)         번역 토큰
 *   onClarification(message)          되물음(human-in-the-loop)
 *   onEvent(type, obj)                기타 타입(analysis/enrichment/files/summaries/result 등)
 *   onDone(obj|null)                  완료
 *   onError(detail)                   오류
 */
(function (global) {
    "use strict";

    function parseFrame(frame) {
        var lines = String(frame || "").split("\n");
        var event = "";
        var dataParts = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf("event:") === 0) event = line.slice(6).trim();
            else if (line.indexOf("data:") === 0) dataParts.push(line.slice(5));
        }
        return { event: event, data: dataParts.join("\n").replace(/^\s*/, "") };
    }

    function dispatch(frame, h) {
        var data = frame.data;
        if (!data || data === "[DONE]") return;

        var j = null;
        var c0 = data.charAt(0);
        if (c0 === "{" || c0 === "[") {
            try { j = JSON.parse(data); } catch (e) { j = null; }
        }
        if (!j) { if (h.onAnswer) h.onAnswer(data); return; }

        // 커스텀 stage/percent 형식(회의록 생성 등, type 없음)
        if (!j.type && j.stage && typeof j.percent !== "undefined") {
            if (h.onProgress) h.onProgress(j.message || "", j.percent);
            if (j.stage === "done" && h.onDone) h.onDone(j.data != null ? j.data : j);
            return;
        }

        switch (j.type) {
            case "progress":
                if (h.onProgress) h.onProgress(j.message || j.step || "", j.percent);
                break;
            case "references":
                if (h.onReferences && Array.isArray(j.docs)) h.onReferences(j.docs);
                break;
            case "answer":
                if (h.onAnswer) h.onAnswer(String(j.content || ""));
                break;
            case "translation":
                if (h.onTranslation) h.onTranslation(String(j.content || ""), j.lang || "");
                else if (h.onAnswer) h.onAnswer(String(j.content || ""));
                break;
            case "clarification_needed":
                if (h.onClarification) h.onClarification(String(j.message || ""));
                break;
            case "analysis":
            case "enrichment":
            case "files":
            case "summaries":
            case "result":
            case "rag_documents":
            case "markdown_preview":
                if (h.onEvent) h.onEvent(j.type, j);
                break;
            case "done":
                if (h.onDone) h.onDone(j);
                break;
            case "error":
                if (h.onError) h.onError(j.detail || j.message || "오류가 발생했습니다.");
                break;
            default:
                if (h.onEvent) h.onEvent(j.type || "", j);
        }
    }

    /**
     * SSE 스트림을 읽어 콜백으로 디스패치한다.
     * @param {string} url
     * @param {object} options fetch 옵션(method/body/headers 등)
     * @param {object} handlers 위 콜백 집합
     */
    async function stream(url, options, handlers) {
        handlers = handlers || {};

        var res = await fetch(url, options);
        if (!res.ok) {
            var t = "";
            try { t = await res.text(); } catch (e) { }
            var err = new Error(t || "요청 처리 중 오류가 발생했습니다.");
            err.status = res.status;
            throw err;
        }
        if (!res.body) {
            var body = "";
            try { body = await res.text(); } catch (e) { }
            if (body && handlers.onAnswer) handlers.onAnswer(body);
            if (handlers.onDone) handlers.onDone(null);
            return;
        }

        var reader = res.body.getReader();
        var decoder = new TextDecoder("utf-8");
        var buf = "";

        while (true) {
            var chunk = await reader.read();
            if (chunk.done) break;
            buf += decoder.decode(chunk.value, { stream: true });

            var sep;
            while ((sep = buf.indexOf("\n\n")) >= 0) {
                var frame = buf.slice(0, sep);
                buf = buf.slice(sep + 2);
                dispatch(parseFrame(frame), handlers);
            }
        }

        if (handlers.onDone) handlers.onDone(null);
    }

    global.SseClient = { stream: stream, parseFrame: parseFrame };
})(window);
