import supabase from "./supabase.js";

export async function getProfile(userId) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

    if (error) {
        console.error("Error getting profile:", error);
        return null;
    }

    return data;
}


export async function updateProfile(userId, updates) {
    const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId)
        .select()
        .single();

    if (error) {
        console.error("Error updating profile:", error);
        return null;
    }

    return data;
}


export async function getUserPosts(userId) {
    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error getting user posts:", error);
        return [];
    }

    return data;
}


export async function getUserPurchases(userId) {
    const { data, error } = await supabase
        .from("purchases")
        .select(`
            id,
            created_at,
            rewards (
                name,
                description,
                cost,
                image
            )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error getting purchases:", error);
        return [];
    }

    return data;
}