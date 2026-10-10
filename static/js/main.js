import { context, initCommon, toast } from "./common.js";
initCommon();
if (
  context.page === "landing" &&
  new URLSearchParams(location.search).get("deleted")
)
  toast("Sua conta e seus dados foram excluídos.");
const modules = {
  login: "auth",
  register: "auth",
  forgot: "auth",
  reset: "auth",
  onboarding: "onboarding",
  placement: "placement",
  home: "dashboard",
  learn: "dashboard",
  progress: "dashboard",
  reviews: "dashboard",
  lesson: "learning",
  review_session: "learning",
  conversation_hub: "conversation",
  chat: "conversation",
  vocabulary: "vocabulary",
  profile: "account",
  preferences: "account",
  privacy: "account",
};
if (modules[context.page])
  import(`./${modules[context.page]}.js`)
    .then((module) => module.init())
    .catch(() => {
      const target = document.getElementById("feature-content");
      if (target)
        target.textContent =
          "Não foi possível carregar. Atualize a página e tente novamente.";
    });
