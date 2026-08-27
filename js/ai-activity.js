import { supabase } from "./supabase.js";
import { earnPoints } from "./points.js";

/**
 * Logs a row in the ai_activity table and awards CUNY Points for it.
 * Used by the AI study assistant (ai/ai.js) when a quiz is completed.
 */
export async function recordAIActivity(
    userId,
    activityType,
    points,
    description
) {
    const { data, error } = await supabase
        .from("ai_activity")
        .insert({
            user_id: userId,
            activity_type: activityType,
            points_earned: points
        })
        .select()
        .single();

    if (error) {
        console.error("Error recording AI activity:", error);
        return false;
    }

    await earnPoints(
        userId,
        points,
        "AI",
        description
    );

    return data;
}
