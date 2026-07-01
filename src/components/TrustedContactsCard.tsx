import { useState } from "react";
import { ArrowUp, Loader2, Phone, Smartphone, Trash2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTrustedContacts } from "@/hooks/useTrustedContacts";
import { normalizePhone, type TrustedContact } from "@/lib/trusted-contacts";

function makeContact(name: string, phone: string): TrustedContact {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name: name.trim(),
    phone: normalizePhone(phone),
  };
}

export function TrustedContactsCard() {
  const {
    contacts,
    canImportFromPhone,
    maxContacts,
    addContact,
    removeContact,
    moveToPrimary,
    importFromPhone,
  } = useTrustedContacts();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [importing, setImporting] = useState(false);

  function submitManualContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    if (name.trim().length < 2) {
      toast.error("Укажите имя контакта");
      return;
    }
    if (normalizedPhone.length < 7) {
      toast.error("Укажите корректный номер телефона");
      return;
    }
    addContact(makeContact(name, normalizedPhone));
    setName("");
    setPhone("");
    toast.success("Доверенный контакт добавлен");
  }

  async function handleImport() {
    try {
      setImporting(true);
      const count = await importFromPhone();
      if (count === 0) {
        toast.info("Не удалось импортировать контакты");
        return;
      }
      toast.success(`Импортировано контактов: ${count}`);
    } catch {
      toast.error("Браузер не дал доступ к контактам");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Доверенные контакты</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Первый контакт считается основным для SOS. Можно хранить до {maxContacts} контактов.
          </p>
        </div>
        <div className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {contacts.length}/{maxContacts}
        </div>
      </div>

      {contacts.length > 0 ? (
        <div className="mt-4 space-y-2">
          {contacts.map((contact, index) => (
            <div
              key={contact.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-medium">{contact.name}</div>
                  {index === 0 && (
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                      Основной
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span className="truncate">{contact.phone}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {index > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveToPrimary(contact.id)}
                    aria-label="Сделать основным"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeContact(contact.id)}
                  aria-label="Удалить контакт"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Пока нет доверенных контактов. Добавьте хотя бы один, чтобы SOS сначала звонил близкому
          человеку.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {canImportFromPhone && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleImport()}
            disabled={importing || contacts.length >= maxContacts}
          >
            {importing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="mr-2 h-4 w-4" />
            )}
            Взять из телефона
          </Button>
        )}
      </div>

      <form onSubmit={submitManualContact} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="trusted_contact_name">Имя</Label>
          <Input
            id="trusted_contact_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Апа"
            maxLength={60}
            disabled={contacts.length >= maxContacts}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="trusted_contact_phone">Телефон</Label>
          <Input
            id="trusted_contact_phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(normalizePhone(e.target.value))}
            placeholder="+7 700 000 00 00"
            maxLength={20}
            disabled={contacts.length >= maxContacts}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full" disabled={contacts.length >= maxContacts}>
            <UserRoundPlus className="mr-2 h-4 w-4" />
            Добавить контакт
          </Button>
        </div>
      </form>
    </Card>
  );
}
