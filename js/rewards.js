import supabase from "./supabase.js";

export async function getRewards() {
    const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .order("cost", { ascending: true });

    if (error) {
        console.error(error);
        return [];
    }

    return data;
}

export async function buyReward(userId, rewardId) {

    const { data: reward, error: rewardError } = await supabase
        .from("rewards")
        .select("*")
        .eq("id", rewardId)
        .single();

    if (rewardError) {
        console.error(rewardError);
        return false;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();

    if (profileError) {
        console.error(profileError);
        return false;
    }

    if (profile.points < reward.cost) {
        alert("Not enough CUNY Connect Points!");
        return false;
    }

    const newPoints = profile.points - reward.cost;

    const { error: updateError } = await supabase
        .from("profiles")
        .update({ points: newPoints })
        .eq("id", userId);

    if (updateError) {
        console.error(updateError);
        return false;
    }

    const { error: purchaseError } = await supabase
        .from("purchases")
        .insert({
            user_id: userId,
            reward_id: rewardId
        });

    if (purchaseError) {
        console.error(purchaseError);
        return false;
    }

    await supabase
        .from("point_transactions")
        .insert({
            user_id: userId,
            amount: -reward.cost,
            transaction_type: "REWARD",
            description: `Purchased ${reward.name}`
        });

    alert(`You purchased ${reward.name}! 🎉`);

    return true;
}