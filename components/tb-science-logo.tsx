import { Github, Users, Mail, Calendar } from "lucide-react";

const links = {
  github: "https://github.com/harbor-framework/terminal-bench-science",
  discord: "https://discord.com/invite/2Pe5uWGcV3",
  email: "stevendi@stanford.edu",
  calendar:
    "https://calendar.google.com/calendar/embed?src=2ca3e7fdc9e51a42ce18142e897f7db23fbf8e65867da1a06dc3ea5e6ad4e893%40group.calendar.google.com&ctz=America%2FLos_Angeles&mode=WEEK",
};

export function TbScienceLogo() {
  return (
    <div className="not-prose flex flex-col items-center my-8">
      <div className="flex items-center gap-4">
        <a
          href={links.github}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Github className="size-4" />
          GitHub
        </a>
        <a
          href={links.discord}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Users className="size-4" />
          Discord
        </a>
        <a
          href={links.calendar}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Calendar className="size-4" />
          Calendar
        </a>
        <a
          href={`mailto:${links.email}`}
          className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Mail className="size-4" />
          Contact
        </a>
      </div>
    </div>
  );
}
