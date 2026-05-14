Rails.application.routes.draw do
  scope "/api" do
    get  "healthz", to: "api/health#show"

    post "auth/register", to: "api/auth#register"
    post "auth/login",    to: "api/auth#login"

    get   "user/me",          to: "api/users#show"
    patch "user/me",          to: "api/users#update"
    post  "user/me/password", to: "api/users#change_password"

    get    "avatar_models",     to: "api/avatar_models#index"
    post   "avatar_models",     to: "api/avatar_models#create"
    patch  "avatar_models/:id", to: "api/avatar_models#update"
    delete "avatar_models/:id", to: "api/avatar_models#destroy"

    post "training/character",  to: "api/training#create"
    post "training/soul_id",    to: "api/training#create"
    get  "training/:id/status", to: "api/training#status"

    get    "generations",     to: "api/generations#index"
    post   "generations",     to: "api/generations#create"
    delete "generations/:id", to: "api/generations#destroy"

    get  "credits",       to: "api/credits#balance"
    get  "pricing",       to: "api/credits#pricing"
    post "credits/add",   to: "api/credits#add"
    post "credits/spend", to: "api/credits#spend"

    post "generate/image",      to: "api/generate#create_image"
    get  "generate/image/:id",  to: "api/generate#image_status"

    post "generate/video",      to: "api/generate#create_video"
    get  "generate/video/:id",  to: "api/generate#video_status"

    post "generate/character",          to: "api/generate#create_higgsfield"
    get  "generate/character/:id/status", to: "api/generate#higgsfield_status"
    post "generate/higgsfield",         to: "api/generate#create_higgsfield"
    get  "generate/higgsfield/:id/status", to: "api/generate#higgsfield_status"

    post "checkout/stripe",         to: "api/checkout#create"
    post "checkout/stripe/confirm", to: "api/checkout#confirm"
    post "webhooks/stripe", to: "api/webhooks#stripe"
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
