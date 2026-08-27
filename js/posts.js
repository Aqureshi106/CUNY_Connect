import { supabase } from "./supabase.js";

export async function createPost(userId, content, category) {

    const { data, error } = await supabase
        .from("posts")
        .insert({
            user_id: userId,
            content: content,
            category: category
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating post:", error);
        return null;
    }

    return data;
}


export async function getPosts() {

    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error getting posts:", error);
        return [];
    }

    return data;
}


export async function deletePost(postId) {

    const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId);

    if (error) {
        console.error("Error deleting post:", error);
        return false;
    }

    return true;
}


export async function likePost(userId, postId) {

    const { error } = await supabase
        .from("post_likes")
        .insert({
            user_id: userId,
            post_id: postId
        });

    if (error) {
        console.error("Error liking post:", error);
        return false;
    }

    return true;
}


export async function unlikePost(userId, postId) {

    const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("user_id", userId)
        .eq("post_id", postId);

    if (error) {
        console.error("Error unliking post:", error);
        return false;
    }

    return true;
}


export async function getLikeCount(postId) {

    const { count, error } = await supabase
        .from("post_likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId);

    if (error) {
        console.error("Error getting likes:", error);
        return 0;
    }

    return count;
}

export async function createComment(userId, postId, content) {

    const { data, error } = await supabase
        .from("comments")
        .insert({
            user_id: userId,
            post_id: postId,
            content: content
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating comment:", error);
        return null;
    }

    return data;
}


export async function getComments(postId) {

    const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error getting comments:", error);
        return [];
    }

    return data;
}


export async function deleteComment(commentId) {

    const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

    if (error) {
        console.error("Error deleting comment:", error);
        return false;
    }

    return true;
}