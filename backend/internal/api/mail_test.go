package api

import (
	"bufio"
	"net"
	"strconv"
	"strings"
	"testing"
)

// fakeSMTP accepts one message (or refuses RCPT with 550) and records DATA.
func fakeSMTP(t *testing.T, refuseRcpt bool) (port int, got chan string) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	got = make(chan string, 1)
	go func() {
		c, err := ln.Accept()
		if err != nil {
			return
		}
		defer c.Close()
		defer ln.Close()
		r := bufio.NewReader(c)
		w := func(s string) { c.Write([]byte(s + "\r\n")) }
		w("220 fake ESMTP")
		var data strings.Builder
		inData := false
		for {
			line, err := r.ReadString('\n')
			if err != nil {
				return
			}
			if inData {
				if line == ".\r\n" {
					inData = false
					got <- data.String()
					w("250 queued")
					continue
				}
				data.WriteString(line)
				continue
			}
			cmd := strings.ToUpper(strings.TrimSpace(line))
			switch {
			case strings.HasPrefix(cmd, "EHLO"), strings.HasPrefix(cmd, "HELO"):
				w("250-fake")
				w("250 AUTH PLAIN")
			case strings.HasPrefix(cmd, "AUTH"):
				w("235 ok")
			case strings.HasPrefix(cmd, "MAIL"):
				w("250 ok")
			case strings.HasPrefix(cmd, "RCPT"):
				if refuseRcpt {
					w("550 no such user")
				} else {
					w("250 ok")
				}
			case cmd == "DATA":
				inData = true
				w("354 go ahead")
			case cmd == "QUIT":
				w("221 bye")
				return
			default:
				w("250 ok")
			}
		}
	}()
	return ln.Addr().(*net.TCPAddr).Port, got
}

func TestDeliverMailOverSMTP(t *testing.T) {
	port, got := fakeSMTP(t, false)
	t.Setenv("SMTP_HOST", "127.0.0.1")
	t.Setenv("SMTP_PORT", strconv.Itoa(port))
	d := deliverMail("resident@example.invalid", "invoices@example.invalid", "Invoice 繁體", "line one\nline two")
	if d.Status != "accepted" || d.Transport != "smtp" {
		t.Fatalf("delivery: %+v", d)
	}
	body := <-got
	if !strings.Contains(body, "Subject: =?UTF-8?B?") || !strings.Contains(body, "line one\r\nline two") {
		t.Fatalf("message: %q", body)
	}
}

func TestDeliverMailRefusedIsFailedAndRedacted(t *testing.T) {
	port, _ := fakeSMTP(t, true)
	t.Setenv("SMTP_URL", "smtp://user:s3cret-pass@127.0.0.1:"+strconv.Itoa(port))
	d := deliverMail("x@example.invalid", "y@example.invalid", "s", "b")
	if d.Status != "failed" {
		t.Fatalf("a 550 before DATA is failed: %+v", d)
	}
	if strings.Contains(d.Detail, "s3cret-pass") {
		t.Fatal("the SMTP password leaked into the stored detail")
	}
}

func TestDeliverMailWithoutSMTPIsLogOnly(t *testing.T) {
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_URL", "")
	if d := deliverMail("a@b.c", "d@e.f", "s", "b"); d.Status != "log-only" || d.Transport != "log" {
		t.Fatalf("%+v", d)
	}
}

// Review finding 1: a notice title must never start a new mail header.
func TestSubjectCannotInjectHeaders(t *testing.T) {
	port, got := fakeSMTP(t, false)
	t.Setenv("SMTP_URL", "")
	t.Setenv("SMTP_HOST", "127.0.0.1")
	t.Setenv("SMTP_PORT", strconv.Itoa(port))
	d := deliverMail("r@example.invalid", "a@b.example", "Water outage\r\nReply-To: phish@evil.example\nContent-Type: text/html", "body")
	if d.Status != "accepted" {
		t.Fatalf("%+v", d)
	}
	msg := <-got
	head := msg[:strings.Index(msg, "\r\n\r\n")]
	for _, bad := range []string{"\r\nReply-To:", "\r\nContent-Type: text/html", "\r\nBcc:"} {
		if strings.Contains(head, bad) {
			t.Fatalf("injected header %q survived:\n%s", bad, head)
		}
	}
	if !strings.Contains(head, "\r\nDate: ") || !strings.Contains(head, "\r\nMessage-ID: <") {
		t.Fatalf("Date / Message-ID missing:\n%s", head)
	}
}
