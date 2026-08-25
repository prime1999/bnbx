import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import {
  getCategoryReferenceVectors,
  classifyAgentVector,
  buildAgentEmbeddingText,
  classifyTextByKeywords,
} from "@/lib/agents/categories";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function normalizeList(val: any): string {
  if (Array.isArray(val)) return val.filter(Boolean).join(", ");
  if (typeof val === "string") return val;
  return "";
}

export async function syncAndAutoCategorizeAgents(subgraphAgents: any[]) {
  console.log("[syncAndAutoCategorizeAgents] Starting sync for agents:", {
    count: subgraphAgents.length,
  });

  const categoryVectors = await getCategoryReferenceVectors();
  console.log("[syncAndAutoCategorizeAgents] Loaded category vectors:", {
    count: categoryVectors?.length ?? 0,
  });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const agent of subgraphAgents) {
    const reg = agent.registrationFile || {};

    const name = reg.name || `Agent #${agent.agentId || agent.id}`;
    const description = reg.description || "No description provided.";
    const a2aSkills = normalizeList(reg.a2aSkills);
    const mcpTools = normalizeList(reg.mcpTools);
    const supportedTrusts = normalizeList(reg.supportedTrusts);

    console.log("[syncAndAutoCategorizeAgents] Processing agent:", {
      agentId: agent.id,
      name,
      chainId: agent.chainId,
    });

    const textToEmbed = buildAgentEmbeddingText({
      name,
      description,
      a2aSkills: reg.a2aSkills,
      mcpTools: reg.mcpTools,
      supportedTrusts: reg.supportedTrusts,
    });
    const contentHash = crypto
      .createHash("sha256")
      .update(textToEmbed)
      .digest("hex");

    console.log("[syncAndAutoCategorizeAgents] Generated content hash:", {
      agentId: agent.id,
      contentHash,
    });

    const { data: existing } = await supabase
      .from("agent_search_index")
      .select("content_hash")
      .eq("agent_id", agent.id)
      .maybeSingle();

    if (existing?.content_hash === contentHash) {
      skippedCount++;
      console.log("[syncAndAutoCategorizeAgents] Skipping unchanged agent:", {
        agentId: agent.id,
        contentHash,
      });
      continue;
    }

    console.log(
      "[syncAndAutoCategorizeAgents] Generating embedding for agent:",
      {
        agentId: agent.id,
        textLength: textToEmbed.length,
      },
    );

    let agentVector: number[] = [];
    let classification = classifyTextByKeywords(textToEmbed);

    try {
      const res = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: textToEmbed,
      });

      const rawRes = res as unknown as {
        embeddings?: Array<{ values: number[] }>;
        embedding?: { values: number[] };
      };
      agentVector =
        rawRes.embeddings?.[0]?.values || rawRes.embedding?.values || [];

      if (agentVector.length > 0) {
        classification = classifyAgentVector(agentVector, categoryVectors);
      }

      console.log("[syncAndAutoCategorizeAgents] Embedding generated:", {
        agentId: agent.id,
        vectorLength: agentVector.length,
      });
    } catch (error) {
      console.warn(
        "[syncAndAutoCategorizeAgents] Embedding failed, using keyword fallback:",
        {
          agentId: agent.id,
          error,
        },
      );
      classification = classifyTextByKeywords(textToEmbed);
    }

    const { category, confidence } = classification;

    if (agentVector.length === 0) {
      console.warn(
        "[syncAndAutoCategorizeAgents] No embedding returned for agent, using fallback classification:",
        {
          agentId: agent.id,
          category,
          confidence,
        },
      );
    }

    console.log("[syncAndAutoCategorizeAgents] Classified agent:", {
      agentId: agent.id,
      category,
      confidence,
    });

    const upsertPayload = {
      agent_id: agent.id,
      chain_id: agent.chainId ? parseInt(agent.chainId, 10) : null,
      owner: agent.owner || null,
      name,
      description,
      image: reg.image || null,
      mcp_endpoint: reg.mcpEndpoint || null,
      mcp_tools: Array.isArray(mcpTools)
        ? JSON.stringify(mcpTools)
        : mcpTools || null,
      a2a_endpoint: reg.a2aEndpoint || null,
      a2a_skills: Array.isArray(a2aSkills)
        ? JSON.stringify(a2aSkills)
        : a2aSkills || null,
      supported_trusts: Array.isArray(supportedTrusts)
        ? JSON.stringify(supportedTrusts)
        : supportedTrusts || null,
      x402_support: Boolean(reg.x402Support),
      ens: reg.ens || null,
      did: reg.did || null,
      total_feedback: agent.totalFeedback
        ? parseInt(agent.totalFeedback, 10)
        : 0,
      inferred_category: category,
      category_confidence: confidence ?? 0.0,
      content_hash: contentHash,
      embedding: agentVector?.length ? agentVector : null,
      updated_at: new Date().toISOString(),
    };

    console.log("[syncAndAutoCategorizeAgents] Upserting payload:", {
      agentId: agent.id,
      category,
      confidence,
      keys: Object.keys(upsertPayload),
    });

    const { error } = await supabase
      .from("agent_search_index")
      .upsert(upsertPayload);

    if (error) {
      console.error(
        `[Supabase Error] Upsert failed for agent ${agent.id}:`,
        error,
      );
    } else {
      updatedCount++;
      console.log("[syncAndAutoCategorizeAgents] Upsert succeeded for agent:", {
        agentId: agent.id,
        category,
      });
    }
  }

  console.log("[syncAndAutoCategorizeAgents] Sync complete:", {
    updatedCount,
    skippedCount,
    totalProcessed: subgraphAgents.length,
  });

  return { updatedCount, skippedCount };
}
