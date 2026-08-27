import supabase from "./supabase.js";

export async function getCurrentProfile() {
    const { data: { user }, error: userError } =
        await supabase.auth.getUser();

    if (userError || !user) {
        console.error("No logged-in user");
        return null;
    }

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("Error getting profile:", error);
        return null;
    }

    return data;
}


export async function getRecentPosts() {
    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error getting posts:", error);
        return [];
    }

    return data;
}


export async function getLeaderboard() {
    const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, college, points")
        .order("points", { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error getting leaderboard:", error);
        return [];
    }

    return data;
}