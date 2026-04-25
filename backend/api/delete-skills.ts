/**
 * One-time utility: Delete all Claude Skills from the Anthropic account
 * so they get re-uploaded with the latest SKILL.md on next server start.
 *
 * Usage: npx tsx backend/api/delete-skills.ts
 */
import Anthropic from "@anthropic-ai/sdk";

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  console.log("Listing all skills...");

  const skillsList = await client.beta.skills.list({ betas: ["skills-2025-10-02"] });
  let count = 0;

  for await (const skill of skillsList) {
    console.log(`  Deleting: ${skill.display_title} (${skill.id})`);
    try {
      await (client.beta.skills as any).delete(skill.id, { betas: ["skills-2025-10-02"] });
      count++;
    } catch (err: any) {
      console.error(`  Failed to delete ${skill.id}: ${err.message}`);
    }
  }

  console.log(`\nDeleted ${count} skill(s). Remove cache files and restart the server:`);
  console.log("  rm -f backend/api/.claude-skill-id backend/api/.claude-skill-hash");
  console.log("  rm -f backend/api/.claude-transformer-skill-id backend/api/.claude-transformer-skill-hash");
}

main().catch(console.error);
