import supabase from "./supabase";

function isCunyEmail(email) {
    return email.toLowerCase().endsWith(".cuny.edu");
}

if (!isCunyEmail(email)) {
    alert("Please use a CUNY student email.");
    return;
}