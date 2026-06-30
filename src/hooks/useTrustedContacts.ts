import { useEffect, useMemo, useState } from "react";
import {
  type TrustedContact,
  loadTrustedContacts,
  mergeTrustedContacts,
  pickContactsFromDevice,
  saveTrustedContacts,
  supportsContactPicker,
} from "@/lib/trusted-contacts";

const MAX_CONTACTS = 5;

export function useTrustedContacts() {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);

  useEffect(() => {
    setContacts(loadTrustedContacts());
  }, []);

  useEffect(() => {
    saveTrustedContacts(contacts);
  }, [contacts]);

  const primaryContact = contacts[0] ?? null;

  const canImportFromPhone = useMemo(() => supportsContactPicker(), []);

  function addContact(contact: TrustedContact) {
    setContacts((current) => mergeTrustedContacts(current, [contact], MAX_CONTACTS));
  }

  function removeContact(id: string) {
    setContacts((current) => current.filter((contact) => contact.id !== id));
  }

  function moveToPrimary(id: string) {
    setContacts((current) => {
      const target = current.find((contact) => contact.id === id);
      if (!target) return current;
      return [target, ...current.filter((contact) => contact.id !== id)];
    });
  }

  async function importFromPhone() {
    const picked = await pickContactsFromDevice();
    if (picked.length === 0) return 0;
    setContacts((current) => mergeTrustedContacts(current, picked, MAX_CONTACTS));
    return picked.length;
  }

  return {
    contacts,
    primaryContact,
    canImportFromPhone,
    maxContacts: MAX_CONTACTS,
    addContact,
    removeContact,
    moveToPrimary,
    importFromPhone,
  };
}
