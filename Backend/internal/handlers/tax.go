package handlers

import "strings"

func normalizeTaxType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "pph":
		return "pph"
	case "none", "nol", "non", "no_tax", "0":
		return "none"
	default:
		return "ppn"
	}
}

func taxLabel(value string) string {
	switch normalizeTaxType(value) {
	case "pph":
		return "PPH"
	case "none":
		return "Pajak"
	default:
		return "PPN"
	}
}

func taxPrefix(value string) string {
	if normalizeTaxType(value) == "pph" {
		return "-"
	}
	return ""
}
