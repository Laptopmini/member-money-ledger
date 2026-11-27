from drf_spectacular.authentication import SessionScheme


class SessionAuth401Scheme(SessionScheme):
    target_class = "ledger.permissions.SessionAuth401"
    name = "sessionAuth"
