import supabase from "./supabase.js";

export async function earnPoints(userId, amount, type, description) {

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();

    if (profileError) {
        console.error(profileError);
        return false;
    }

    const newBalance = profile.points + amount;

    const { error: updateError } = await supabase
        .from("profiles")
        .update({ points: newBalance })
        .eq("id", userId);

    if (updateError) {
        console.error(updateError);
        return false;
    }

    const { error: transactionError } = await supabase
        .from("point_transactions")
        .insert({
            user_id: userId,
            amount: amount,
            transaction_type: type,
            description: description
        });

    if (transactionError) {
        console.error(transactionError);
        return false;
    }

    return true;
}

export async function spendPoints(userId, amount, description) {

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();

    if (profileError) {
        console.error(profileError);
        return false;
    }

    if (profile.points < amount) {
        alert("Not enough CUNY Connect Points.");
        return false;
    }

    const newBalance = profile.points - amount;

    const { error: updateError } = await supabase
        .from("profiles")
        .update({ points: newBalance })
        .eq("id", userId);

    if (updateError) {
        console.error(updateError);
        return false;
    }

    const { error: transactionError } = await supabase
        .from("point_transactions")
        .insert({
            user_id: userId,
            amount: -amount,
            transaction_type: "REWARD",
            description: description
        });

    if (transactionError) {
        console.error(transactionError);
        return false;
    }

    return true;
}