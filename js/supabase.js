const SUPABASE_URL = "https://upxeexlrvelihcamcqdm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bE4JhqqN1BV4JEk4Fm22ng_2fV6WcPK";

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

export default supabase;