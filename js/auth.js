import supabase from "./supabase.js";

function isCunyEmail(email) {
    return email.toLowerCase().endsWith(".cuny.edu");
}

export async function signUp(email, password, firstName, lastName, college, major) {

    if (!isCunyEmail(email)) {
        alert("Please use a CUNY student email.");
        return;
    }

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        alert(error.message);
        return;
    }

    const user = data.user;

    if (user) {
        const { error: profileError } = await supabase
            .from("profiles")
            .insert({
                id: user.id,
                first_name: firstName,
                last_name: lastName,
                email: email,
                college: college,
                major: major,
                points: 0
            });

        if (profileError) {
            console.error(profileError);
            alert("Account created, but profile setup failed.");
            return;
        }
    }

    alert("Account created successfully!");
}

export async function login(email, password) {

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        alert(error.message);
        return;
    }

    window.location.href = "dashboard.html";
}

export async function logout() {

    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error(error);
        return;
    }

    window.location.href = "index.html";
}