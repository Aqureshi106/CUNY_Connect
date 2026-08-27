import supabase from "./supabase.js";
import { earnPoints } from "./points.js";

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