/**
 * 답변 번역 선택 유틸.
 * UI 자체 번역이 아니라, 서버에 translate_to 파라미터를 보내기 위한 용도.
 */
const TRANSLATE = {
    langs: [
        { code: "en", label: "영어" },
        { code: "ja", label: "일본어" },
        { code: "zh", label: "중국어" },
    ],

    getLabel(code) {
        const lang = this.langs.find(l => l.code === code);
        return lang ? lang.label : code;
    },
};
