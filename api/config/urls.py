from django.conf import settings
from django.urls import URLPattern, URLResolver, include, path, re_path

from ledger.errors import handler404 as handler404_view  # noqa: E402

handler400 = "ledger.errors.handler400"
handler404 = "ledger.errors.handler404"
handler500 = "ledger.errors.handler500"

urlpatterns: list[URLPattern | URLResolver] = [path("api/", include("ledger.urls"))]

if settings.DEBUG:
    from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

    urlpatterns += [
        path("api/schema", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    ]

# Last: any unknown path gets the JSON envelope (also when DEBUG would show an HTML 404).
urlpatterns += [re_path(r"^.*$", lambda request: handler404_view(request))]
