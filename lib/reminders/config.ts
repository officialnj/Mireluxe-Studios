// ─────────────────────────────────────────────────────────────
// MIRILUXE booking reminders — studio settings
// Edit this file to change wording, address, policies or branding.
// ─────────────────────────────────────────────────────────────

export const STUDIO = {
  name: "MIRILUXE Studios",
  stylistName: "Mirakle",
  signOff: "Love, Mirakle",
  phone: "+44 20 7946 0231",
  phoneIntl: "+442079460231",
  address: {
    line1: "Wembley",
    line2: "North West London",
    town: "HA9",
    postcode: "",
  },
  website: "https://miriluxe.co.uk",
  timezone: "Europe/London",

  // Sender — must be on a domain verified in Resend
  fromEmail: "MIRILUXE Studios <bookings@miriluxe.co.uk>",
  replyTo: "Mireluxestudios@outlook.com",

  // Brand colours used in the email
  colors: {
    background: "#F6F1EB",
    card: "#FFFFFF",
    ink: "#1A1714",
    muted: "#6E655C",
    accent: "#B08D57", // gold
    rule: "#E7DFD5",
  },
};

// Policy sections shown in every email. Order = display order.
export const POLICIES: { title: string; points: string[] }[] = [
  {
    title: "Hair preparation",
    points: [
      "Please arrive with your hair freshly blow-dried and free of any oils and conditioners.",
      "Oils don't work well with the products used, so if hair isn't prepped you may be turned away.",
    ],
  },
  {
    title: "Lateness",
    points: [
      "Running late? Contact your stylist as soon as possible, otherwise you may not be seen.",
      "There is a 15-minute grace period. After that, a £10 charge applies for every 10 minutes.",
      "After 45 minutes late, your appointment will be cancelled.",
    ],
  },
  {
    title: "Parking",
    points: [
      "Park in a bay marked with a YELLOW CIRCLE (along the wall) or a bay numbered 1 or 9 on the floor.",
      "You must sign your vehicle in at reception within 10 minutes, or you risk a penalty charge.",
      "If none of these bays are free, please park off-site and walk to reception.",
    ],
  },
  {
    title: "Payment",
    points: ["Please bring cash to pay on the day."],
  },
];

// When reminders go out (hours before the appointment)
export const REMINDER_WINDOWS = {
  "48h": 48,
  "24h": 24,
} as const;
