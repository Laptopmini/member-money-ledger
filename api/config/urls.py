from django.urls import path

from config import views

urlpatterns = [
    path("api/ping", views.ping),
    path("api/transactions", views.transactions),
]
