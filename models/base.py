"""Serialização do contrato público existente; os nomes SQL continuam estáveis."""


def camel_case(name):
    head, *tail = name.split("_")
    return head + "".join(part.title() for part in tail)


class PublicModel:
    hidden_fields = frozenset()

    def to_dict(self):
        return {
            camel_case(column.name): getattr(self, column.name)
            for column in self.__table__.columns
            if column.name not in self.hidden_fields
        }
