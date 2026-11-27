from django.urls import path

from . import views

urlpatterns = [
    path("health", views.HealthView.as_view()),
    path("ping", views.PingView.as_view()),  # legacy alias of /api/health
    path("categories", views.CategoriesView.as_view()),
    path("transactions", views.TransactionListView.as_view()),
    path("transactions/<str:txn_id>", views.TransactionDetailView.as_view()),
    path("transactions/<str:txn_id>/history", views.TransactionHistoryView.as_view()),
    path("summary", views.SummaryView.as_view()),
    path("sync", views.SyncView.as_view()),
    path("sync/status", views.SyncStatusView.as_view()),
]
