package org.sharingbridge.integration.web;

import java.util.Map;
import org.sharingbridge.integration.service.SuggestVendorsService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SuggestVendorsController {

    private final SuggestVendorsService suggestVendorsService;

    public SuggestVendorsController(SuggestVendorsService suggestVendorsService) {
        this.suggestVendorsService = suggestVendorsService;
    }

    @PostMapping("/v1/donor-setup/suggest-vendors")
    public Map<String, Object> suggest(@RequestBody(required = false) Map<String, Object> payload) {
        return suggestVendorsService.suggest(payload);
    }
}
