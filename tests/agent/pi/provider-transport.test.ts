import { describe, expect, it } from "vitest";
import {
  buildPiProviderRequest,
  parsePiProviderResponse
} from "../../../src/agent/pi/pi-provider-transport";
import type { PiProviderTurnInput } from "../../../src/agent/pi/pi-provider-transport";

function turnInput(
  kind: PiProviderTurnInput["profile"]["kind"],
  baseUrl = ""
): PiProviderTurnInput {
  return {
    profile: {
      id: kind,
      name: kind,
      kind,
      apiKey: "secret",
      baseUrl
    },
    modelId: kind === "deepseek" ? "deepseek-v4-flash" : "MiniMax-M3",
    systemPrompt: "Be precise",
    messages: [{ role: "user", content: "hello" }],
    tools: [],
    thinkingEnabled: true
  };
}

describe("Pi provider transport", () => {
  it("routes DeepSeek through the normalized Anthropic messages endpoint", () => {
    for (const baseUrl of [
      "",
      "https://api.deepseek.com",
      "https://api.deepseek.com/anthropic",
      "https://api.deepseek.com/v1/messages"
    ]) {
      const request = buildPiProviderRequest(turnInput("deepseek", baseUrl));
      expect(request.url).toBe("https://api.deepseek.com/anthropic/v1/messages");
      expect(request.responseFormat).toBe("anthropic");
      expect(request.body).toMatchObject({
        thinking: { type: "enabled" },
        messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }]
      });
    }
  });

  it("parses a DeepSeek Anthropic response including thinking", () => {
    expect(
      parsePiProviderResponse(turnInput("deepseek").profile, {
        content: [
          { type: "thinking", thinking: "reasoning" },
          { type: "text", text: "answer" }
        ],
        stop_reason: "end_turn"
      })
    ).toMatchObject({ text: "answer", thinking: "reasoning", stopReason: "stop" });
  });

  it("keeps MiniMax on its Anthropic endpoint without duplicating the path", () => {
    const request = buildPiProviderRequest(
      turnInput("anthropic", "https://api.minimaxi.com/anthropic")
    );
    expect(request.url).toBe("https://api.minimaxi.com/anthropic/v1/messages");
    expect(request.body).toMatchObject({ thinking: { type: "adaptive" } });
  });
});
