from django.urls import path

from . import auth_views, rules_views, suggest_views, tax_views, views

urlpatterns = [
    path("health", views.HealthView.as_view()),
    path("ping", views.PingView.as_view()),  # legacy alias of /api/health
    path("categories", views.CategoriesView.as_view()),
    path("transactions", views.TransactionListView.as_view()),
    path("transactions/<str:txn_id>", views.TransactionDetailView.as_view()),
    path("transactions/<str:txn_id>/suggestion", suggest_views.SuggestionView.as_view()),
    path("transactions/<str:txn_id>/history", views.TransactionHistoryView.as_view()),
    path("summary", views.SummaryView.as_view()),
    path("flags", auth_views.FlagsView.as_view()),
    path("auth/csrf", auth_views.CsrfView.as_view()),
    path("auth/login", auth_views.LoginView.as_view()),
    path("auth/logout", auth_views.LogoutView.as_view()),
    path("auth/me", auth_views.MeView.as_view()),
    path("tax/set-aside", tax_views.SetAsideView.as_view()),
    path("tax/settings", tax_views.TaxSettingsView.as_view()),
    path("tax/set-aside-marks", tax_views.SetAsideMarkView.as_view()),
    path("rules/preview", rules_views.RulePreviewView.as_view()),
    path("rules", rules_views.RuleListView.as_view()),
    path("rules/<int:rule_id>", rules_views.RuleDetailView.as_view()),
    path("sync", views.SyncView.as_view()),
    path("sync/status", views.SyncStatusView.as_view()),
]
