package kr.co.ultari.chatbot.generate.service;

import lombok.experimental.UtilityClass;
import org.json.JSONArray;
import org.json.JSONObject;

@UtilityClass
public class SseDeltaExtractor {

    public static String extractDelta(String raw) {
        if (raw == null) return null;

        StringBuilder out = new StringBuilder();
        String[] lines = raw.split("\n");
        for (String line : lines) {
            String s = line.trim();
            if (s.isEmpty()) continue;

            if (s.startsWith("data:")) {
                String data = s.substring(5).trim();
                if (data.equals("[DONE]")) continue;

                try {
                    JSONObject obj = new JSONObject(data);

                    if (obj.has("choices")) {
                        JSONArray choices = obj.getJSONArray("choices");
                        if (!choices.isEmpty()) {
                            JSONObject c0 = choices.getJSONObject(0);

                            if (c0.has("delta")) {
                                JSONObject delta = c0.getJSONObject("delta");
                                if (delta.has("content")) out.append(delta.getString("content"));
                            } else if (c0.has("message")) {
                                JSONObject msg = c0.getJSONObject("message");
                                if (msg.has("content")) out.append(msg.getString("content"));
                            }
                        }
                    } else if (obj.has("content")) {
                        out.append(obj.getString("content"));
                    } else if (obj.has("percent")) {
                        out.append(obj.getString("percent"));
                    }
                } catch (Exception ignore) {
                    out.append(data);
                }
            } else {
                out.append(line);
            }
        }

        return out.toString();
    }
}
