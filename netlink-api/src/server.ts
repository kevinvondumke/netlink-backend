import { env } from "./config/env";
import { createApp } from "./app";

const PORT = env.PORT;

const app = createApp();

app.listen(PORT, "0.0.0.0", () => {
    console.log(`\nNETLINK API LISTENING ON PORT ${PORT}`);
});